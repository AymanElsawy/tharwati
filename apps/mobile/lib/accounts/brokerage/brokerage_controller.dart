import '../create_submission.dart';
import 'dart:async';
import 'package:flutter/foundation.dart';

import '../../core/data_change.dart';
import '../../core/decimals.dart';
import '../../core/idempotency_key.dart';
import '../../core/mutation_refresh.dart';
import '../../core/read_deadline.dart';
import '../../errors/safe_app_error.dart';
import '../../portfolio/portfolio_models.dart';
import '../../portfolio/portfolio_repository.dart';
import '../account_models.dart';
import '../accounts_repository.dart' show AccountsException;
import '../accounts_service.dart';
import 'brokerage_activity.dart';
import 'brokerage_models.dart';
import 'brokerage_repository.dart';
import 'brokerage_valuation.dart';
import 'brokerage_submission.dart';

enum BrokerageStatus { loading, error, ready }

/// Drives one brokerage account's detail screen: its open holdings, their live
/// market prices, and the buy / sell mutations.
class BrokerageController extends ChangeNotifier {
  BrokerageController({
    required this.accountId,
    BrokerageRepository? repository,
    Future<PortfolioFxRate?> Function(String from, String to)? fxRateLoader,
  }) : _repo = repository ?? BrokerageRepository(),
       _fxRateLoader = fxRateLoader ??
           ((from, to) => SupabasePortfolioDataSource().loadFxRate(from, to));

  final String accountId;
  final BrokerageRepository _repo;
  final Future<PortfolioFxRate?> Function(String from, String to) _fxRateLoader;

  BrokerageStatus status = BrokerageStatus.loading;
  BrokerageValuation? valuation;
  bool fxLoading = false;
  bool busy = false;
  String? actionError;

  /// The account's ledger, already resolved for corrections and reversals.
  List<ActivityItem> activity = const [];

  /// Activity loads alongside holdings but fails independently — a broken feed
  /// must not hide the portfolio (web keeps separate `holdingsError` /
  /// `activityError` flags).
  bool activityFailed = false;
  AppErrorCode? activityErrorCode;
  bool refreshStale = false;
  AppErrorCode? readErrorCode;
  final PayloadIdempotencyKey _existingAttempt = PayloadIdempotencyKey();
  final PayloadIdempotencyKey _tradeAttempt = PayloadIdempotencyKey();
  final PayloadIdempotencyKey _dividendAttempt = PayloadIdempotencyKey();

  List<ActivityDateGroup> get activityGroups =>
      groupActivityByLocalDate(activity);

  /// Guards against a slow reload overwriting a newer one.
  int _requestVersion = 0;

  @override
  void dispose() {
    _requestVersion++;
    super.dispose();
  }

  Future<bool> load({bool preserveOnError = false}) async {
    final version = ++_requestVersion;
    if (!preserveOnError) status = BrokerageStatus.loading;
    fxLoading = false;
    notifyListeners();
    try {
      final (holdings, prices, cash) = await readWithDeadline(
        compositeReadDeadline,
        (_) async {
          final holdings = await _repo.getHoldingsForAccount(accountId);
          final prices = await _repo.getPrices([
            for (final h in holdings) h.assetId,
          ]);
          final cash = await _repo.getCashBalance(accountId);
          return (holdings, prices, cash);
        },
      );
      if (version != _requestVersion) return false;
      final pairs = <String, (String, String)>{};
      for (final holding in holdings) {
        final price = prices[holding.assetId];
        if (!D.isPositive(holding.quantity) ||
            price == null ||
            price.currencyCode != holding.asset.currencyCode ||
            price.currencyCode == holding.costCurrencyCode) {
          continue;
        }
        pairs['${price.currencyCode}/${holding.costCurrencyCode}'] = (
          price.currencyCode,
          holding.costCurrencyCode,
        );
      }
      valuation = valueBrokerageAccount(
        holdings: holdings,
        pricesByAssetId: prices,
        cashBalance: cash,
      );
      status = BrokerageStatus.ready;
      readErrorCode = null;
      fxLoading = pairs.isNotEmpty;
      if (fxLoading) notifyListeners();

      if (pairs.isNotEmpty) {
        final results = await Future.wait([
          for (final entry in pairs.entries)
            () async {
              try {
                return MapEntry(
                  entry.key,
                  await _fxRateLoader(entry.value.$1, entry.value.$2),
                );
              } catch (_) {
                return MapEntry<String, PortfolioFxRate?>(entry.key, null);
              }
            }(),
        ]);
        if (version != _requestVersion) return false;
        valuation = valueBrokerageAccount(
          holdings: holdings,
          pricesByAssetId: prices,
          fxRatesByPair: {
            for (final result in results)
              if (result.value != null) result.key: result.value!,
          },
          cashBalance: cash,
        );
        fxLoading = false;
        notifyListeners();
      }

      try {
        final rows = await _repo.getActivity(accountId);
        if (version != _requestVersion) return false;
        activity = presentActivity(rows);
        activityFailed = false;
        activityErrorCode = null;
      } catch (error) {
        if (version != _requestVersion) return false;
        if (!preserveOnError) activity = const [];
        activityFailed = true;
        activityErrorCode = classifyAppError(error).code;
        if (preserveOnError) refreshStale = true;
      }
    } catch (error) {
      if (version != _requestVersion) return false;
      fxLoading = false;
      readErrorCode = classifyAppError(error).code;
      if (preserveOnError) {
        refreshStale = true;
        status = BrokerageStatus.ready;
      } else {
        valuation = null;
        status = BrokerageStatus.error;
      }
      notifyListeners();
      return false;
    }
    if (!activityFailed) refreshStale = false;
    if (version == _requestVersion) notifyListeners();
    return !activityFailed;
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

  Future<bool> submitTrade(TradeFormValues values) async {
    final key = _tradeAttempt.forPayload(
      brokerageTradeFingerprint(accountId, values),
    );
    final committed = await _runBrokerageCreate(
      () => values.side == TradeSide.buy
          ? _repo.addBuy(accountId, values, key)
          : _repo.addSell(accountId, values, key),
    );
    if (committed) _tradeAttempt.clear();
    return committed;
  }

  Future<bool> addExistingHolding(ExistingHoldingFormValues values) async {
    if (busy) return false;
    final key = _existingAttempt.forPayload(
      createFingerprint(existingHoldingRpcParams(accountId, values)),
    );
    final committed = await _runBrokerageCreate(
      () => _repo.addExistingHolding(accountId, values, key),
    );
    if (committed) _existingAttempt.clear();
    return committed;
  }

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
  }) async {
    final key = _dividendAttempt.forPayload(
      brokerageDividendFingerprint(
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
    final committed = await _runBrokerageCreate(
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
        idempotencyKey: key,
      ),
    );
    if (committed) _dividendAttempt.clear();
    return committed;
  }

  Future<bool> _runBrokerageCreate(Future<void> Function() action) async {
    busy = true;
    actionError = null;
    notifyListeners();
    final outcome = await runMutation(
      action,
      errorMessage: (error) => error is AccountsException
          ? error.message
          : 'Something went wrong. Please try again.',
    );
    busy = false;
    if (outcome is MutationRejected) {
      actionError = outcome.message;
      notifyListeners();
      return false;
    }
    DataChange.instance.ping();
    notifyListeners();
    unawaited(load(preserveOnError: true));
    return true;
  }

  Future<void> retryRefresh() async {
    await load(preserveOnError: true);
  }

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

Map<String, String> validateExistingHolding(
  ExistingHoldingFormValues v, {
  required bool crossCurrency,
}) {
  final errors = <String, String>{};
  final decimal = RegExp(r'^\d{1,18}(?:\.\d{1,10})?$');
  bool positive(String value) =>
      decimal.hasMatch(value.trim()) &&
      (double.tryParse(value.trim()) ?? 0) > 0;

  if (v.assetId.trim().isEmpty) {
    errors['assetId'] = 'Choose an instrument.';
  }
  if (!positive(v.quantity)) {
    errors['quantity'] = 'Enter a quantity greater than zero.';
  }
  if (!positive(v.averageCost)) {
    errors['averageCost'] = 'Enter an average cost greater than zero.';
  }
  if (DateTime.tryParse(v.occurredAt) == null) {
    errors['occurredAt'] = 'Date and time are required.';
  }
  if (crossCurrency && !positive(v.accountFxRate ?? '')) {
    errors['accountFxRate'] = 'Enter the exchange rate.';
  }
  return errors;
}

/// Validation for the buy / sell form — mirrors the web dialogs' `valid` gate.
final RegExp _tradeDecimalPattern = RegExp(r'^\d{1,18}(?:\.\d{1,10})?$');

/// Trade inputs use ASCII digits and a dot; other separators are never removed.
bool isTradeDecimalLiteral(String value) =>
    _tradeDecimalPattern.hasMatch(value);

Map<String, String> validateTrade(TradeFormValues v, {Holding? sellingFrom}) {
  final errors = <String, String>{};

  if (v.assetId.trim().isEmpty) {
    errors['assetId'] = 'Choose an instrument.';
  }
  final qty = v.quantity;
  if (!isTradeDecimalLiteral(qty) || (D.compare(qty, '0') ?? 0) <= 0) {
    errors['quantity'] = 'Enter a quantity greater than zero.';
  } else if (v.side == TradeSide.sell && sellingFrom != null) {
    final comparison = D.compare(qty, sellingFrom.quantity);
    if (comparison == null || comparison > 0) {
      errors['quantity'] =
          'You only hold ${D.normalize(sellingFrom.quantity) ?? sellingFrom.quantity}.';
    }
  }
  final price = v.unitPrice;
  if (!isTradeDecimalLiteral(price) || (D.compare(price, '0') ?? 0) <= 0) {
    errors['unitPrice'] = 'Enter a price greater than zero.';
  }
  final fees = v.fees;
  if (fees.isNotEmpty &&
      (!isTradeDecimalLiteral(fees) || (D.compare(fees, '0') ?? -1) < 0)) {
    errors['fees'] = 'Fees must be zero or more.';
  }
  if (DateTime.tryParse(v.occurredAt) == null) {
    errors['occurredAt'] = 'Date and time are required.';
  }
  final rate = v.accountFxRate;
  if (rate != null &&
      (rate.isEmpty ||
          !isTradeDecimalLiteral(rate) ||
          (D.compare(rate, '0') ?? 0) <= 0)) {
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
