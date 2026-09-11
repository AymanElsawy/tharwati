import 'package:flutter/foundation.dart';

import '../../core/data_change.dart';
import '../account_models.dart';
import '../accounts_repository.dart' show AccountsException;
import '../accounts_service.dart';
import 'brokerage_activity.dart';
import 'brokerage_models.dart';
import 'brokerage_repository.dart';
import 'brokerage_valuation.dart';

enum BrokerageStatus { loading, error, ready }

/// Drives one brokerage account's detail screen: its open holdings, their live
/// market prices, and the buy / sell mutations.
class BrokerageController extends ChangeNotifier {
  BrokerageController({
    required this.accountId,
    BrokerageRepository? repository,
  }) : _repo = repository ?? BrokerageRepository();

  final String accountId;
  final BrokerageRepository _repo;

  BrokerageStatus status = BrokerageStatus.loading;
  BrokerageValuation? valuation;
  bool busy = false;
  String? actionError;

  /// The account's ledger, already resolved for corrections and reversals.
  List<ActivityItem> activity = const [];

  /// Activity loads alongside holdings but fails independently — a broken feed
  /// must not hide the portfolio (web keeps separate `holdingsError` /
  /// `activityError` flags).
  bool activityFailed = false;

  List<ActivityDateGroup> get activityGroups =>
      groupActivityByLocalDate(activity);

  /// Guards against a slow reload overwriting a newer one.
  int _requestVersion = 0;

  Future<void> load() async {
    final version = ++_requestVersion;
    status = BrokerageStatus.loading;
    notifyListeners();
    try {
      final holdings = await _repo.getHoldingsForAccount(accountId);
      final prices = await _repo.getPrices([
        for (final h in holdings) h.assetId,
      ]);
      final cash = await _repo.getCashBalance(accountId);
      if (version != _requestVersion) return;
      valuation = valueBrokerageAccount(
        holdings: holdings,
        pricesByAssetId: prices,
        cashBalance: cash,
      );
      status = BrokerageStatus.ready;

      try {
        final rows = await _repo.getActivity(accountId);
        if (version != _requestVersion) return;
        activity = presentActivity(rows);
        activityFailed = false;
      } catch (_) {
        if (version != _requestVersion) return;
        activity = const [];
        activityFailed = true;
      }
    } catch (_) {
      if (version != _requestVersion) return;
      valuation = null;
      status = BrokerageStatus.error;
    }
    if (version == _requestVersion) notifyListeners();
  }

  void clearActionError() {
    if (actionError == null) return;
    actionError = null;
    notifyListeners();
  }

  Future<List<AssetSearchResult>> searchAssets(String query) =>
      _repo.searchAssets(query);

  Future<String?> resolveAsset(AssetSearchResult result) async {
    try {
      return await _repo.resolveAsset(result);
    } on AccountsException catch (e) {
      actionError = e.message;
      notifyListeners();
      return null;
    }
  }

  Future<bool> submitTrade(TradeFormValues values) => _run(
    () => values.side == TradeSide.buy
        ? _repo.addBuy(accountId, values)
        : _repo.addSell(accountId, values),
  );

  Future<bool> submitDividend({
    required String assetId,
    required DividendMode mode,
    required String gross,
    required String tax,
    required String fees,
    required String occurredAt,
    String? notes,
    String? unitPrice,
    String? reinvestedAmount,
  }) => _run(
    () => _repo.addDividend(
      accountId: accountId,
      assetId: assetId,
      mode: mode,
      gross: gross,
      tax: tax,
      fees: fees,
      occurredAt: occurredAt,
      notes: notes,
      unitPrice: unitPrice,
      reinvestedAmount: reinvestedAmount,
    ),
  );

  Future<List<ActivityItem>> holdingHistory(String assetId) async {
    final rows = await _repo.getHoldingHistory(accountId, assetId);
    return presentActivity(rows);
  }

  Future<bool> reverseExistingHolding(String transactionId) =>
      _run(() => _repo.reverseExistingHolding(transactionId));

  Future<bool> correctExistingHolding({
    required String originalTransactionId,
    required String quantity,
    required String averageCost,
    required String occurredAt,
    String? notes,
    String? accountFxRate,
  }) => _run(
    () => _repo.correctExistingHolding(
      originalTransactionId: originalTransactionId,
      quantity: quantity,
      averageCost: averageCost,
      occurredAt: occurredAt,
      notes: notes,
      accountFxRate: accountFxRate,
    ),
  );

  HoldingValuation? valuationForAsset(String assetId) {
    for (final entry in valuation?.holdings ?? const <HoldingValuation>[]) {
      if (entry.holding.assetId == assetId) return entry;
    }
    return null;
  }

  Future<bool> _run(Future<void> Function() action) async {
    if (busy) return false;
    busy = true;
    actionError = null;
    notifyListeners();
    try {
      await action();
      await load();
      // Holdings changed the account's cash and value — refresh everything
      // else that reads them (the mobile stand-in for the web
      // `tharwati:data-changed` event).
      DataChange.instance.ping();
      return true;
    } on AccountsException catch (e) {
      actionError = e.message;
      return false;
    } catch (_) {
      actionError = 'Something went wrong. Please try again.';
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  /// The holdings a sell can be raised against.
  List<Holding> get sellableHoldings => [
    for (final entry in valuation?.holdings ?? const <HoldingValuation>[])
      entry.holding,
  ];

  /// A buy defaults its unit price to the last known market price.
  String? lastPriceFor(String assetId) {
    for (final entry in valuation?.holdings ?? const <HoldingValuation>[]) {
      if (entry.holding.assetId == assetId) return entry.marketPrice?.price;
    }
    return null;
  }

  Holding? holdingForAsset(String assetId) {
    for (final entry in valuation?.holdings ?? const <HoldingValuation>[]) {
      if (entry.holding.assetId == assetId) return entry.holding;
    }
    return null;
  }
}

/// Validation for the buy / sell form — mirrors the web dialogs' `valid` gate.
Map<String, String> validateTrade(TradeFormValues v, {Holding? sellingFrom}) {
  final errors = <String, String>{};
  final positive = RegExp(r'^\d{1,18}(?:\.\d{1,10})?$');
  final money = RegExp(r'^\d{1,18}(?:\.\d{1,10})?$');

  if (v.assetId.trim().isEmpty) {
    errors['assetId'] = 'Choose an instrument.';
  }
  final qty = v.quantity.trim();
  if (!positive.hasMatch(qty) ||
      double.tryParse(qty) == null ||
      double.parse(qty) <= 0) {
    errors['quantity'] = 'Enter a quantity greater than zero.';
  } else if (v.side == TradeSide.sell && sellingFrom != null) {
    final held = double.tryParse(sellingFrom.quantity) ?? 0;
    if (double.parse(qty) > held) {
      errors['quantity'] = 'You only hold ${sellingFrom.quantity}.';
    }
  }
  final price = v.unitPrice.trim();
  if (!money.hasMatch(price) ||
      double.tryParse(price) == null ||
      double.parse(price) <= 0) {
    errors['unitPrice'] = 'Enter a price greater than zero.';
  }
  final fees = v.fees.trim();
  if (fees.isNotEmpty &&
      (!money.hasMatch(fees) || (double.tryParse(fees) ?? -1) < 0)) {
    errors['fees'] = 'Fees must be zero or more.';
  }
  if (DateTime.tryParse(v.occurredAt) == null) {
    errors['occurredAt'] = 'Date and time are required.';
  }
  final rate = v.accountFxRate;
  if (rate != null &&
      (rate.trim().isEmpty ||
          !money.hasMatch(rate.trim()) ||
          (double.tryParse(rate.trim()) ?? 0) <= 0)) {
    errors['accountFxRate'] = 'Enter the exchange rate for this trade.';
  }
  return errors;
}

/// The account row a brokerage screen needs from the accounts list.
Account? findAccount(AccountsListModel? model, String id) {
  for (final item in model?.items ?? const <AccountItem>[]) {
    if (item.account.id == id) return item.account;
  }
  return null;
}
