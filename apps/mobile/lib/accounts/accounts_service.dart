import '../core/data_change.dart';
import '../dashboard/data/dashboard_repository.dart';
import 'account_form.dart';
import 'account_models.dart';
import 'account_valuation.dart';
import 'accounts_repository.dart';
import 'metal/metal_purity.dart';
import 'metal_purchase_form.dart';
import 'metal_purchases_repository.dart';

/// One account plus its resolved "Current Value" and lifecycle eligibility.
class AccountItem {
  const AccountItem({
    required this.account,
    required this.value,
    required this.lifecycle,
  });

  final Account account;
  final ResolvedValue value;
  final AccountLifecycle? lifecycle;
}

class AccountsListModel {
  const AccountsListModel({required this.items});
  final List<AccountItem> items;

  bool get isEmpty => items.isEmpty;
}

/// Everything the gold/silver account-details page needs.
class GoldAccountDetail {
  const GoldAccountDetail({
    required this.account,
    required this.purchases,
    required this.currentValue,
    required this.pricePerGram,
  });

  final Account account;
  final List<MetalPurchase> purchases; // effective, newest first
  final ResolvedValue currentValue;

  /// Pure-metal spot price per gram in the account's currency, recovered from
  /// the snapshot total (see `metal/metal_purity.dart`). Null = unavailable.
  final String? pricePerGram;

  /// The per-purity breakdown, sorted by purity code.
  List<MetalPurityAggregate> get purities =>
      aggregateByPurity(purchases, pricePerGram);

  List<MetalPurchase> purchasesForPurity(String purity) =>
      purchases.where((p) => p.purity == purity).toList();
}

/// Orchestrates the Accounts tab: resolves per-type current value on load and
/// funnels every mutation through the RPC repositories, pinging [DataChange]
/// after each success (the mobile stand-in for the web `tharwati:data-changed`
/// event, docs/accounts.md §4). A single-flight guard mirrors the web
/// "only one mutation in flight" rule.
class AccountsService {
  AccountsService({
    AccountsRepository? accounts,
    MetalPurchasesRepository? metal,
    DashboardRepository? dashboard,
  }) : _accounts = accounts ?? AccountsRepository(),
       _metal = metal ?? MetalPurchasesRepository(),
       _dashboard = dashboard ?? DashboardRepository();

  final AccountsRepository _accounts;
  final MetalPurchasesRepository _metal;
  final DashboardRepository _dashboard;

  bool _mutating = false;

  Future<AccountsListModel> loadAccounts() async {
    final accounts = await _accounts.getAccounts();

    final ledgerIds = [
      for (final a in accounts)
        if (a.type == AccountType.cash ||
            a.type == AccountType.bank ||
            a.type == AccountType.brokerage)
          a.id,
    ];
    final valuedIds = [
      for (final a in accounts)
        if (a.type.isValued) a.id,
    ];
    // Gold and Brokerage both get their list value from the shared
    // `dashboard-valuation` snapshot: gold from the metal spot price, brokerage
    // from cash + holdings marked to market.
    final snapshotIds = [
      for (final a in accounts)
        if (a.type == AccountType.gold || a.type == AccountType.brokerage) a.id,
    ];
    final allIds = [for (final a in accounts) a.id];

    final balances = {
      for (final b in await _accounts.getAccountBalances(ledgerIds))
        b.accountId: b,
    };
    final valuations = <String, AccountValuation>{};
    for (final v in await _accounts.getEffectiveValuations(valuedIds)) {
      valuations.putIfAbsent(v.accountId, () => v); // list is latest-first
    }
    final lifecycle = {
      for (final l in await _accounts.getLifecycleEligibility(allIds))
        l.accountId: l,
    };

    Map<String, String?> snapshotValues = const {};
    if (snapshotIds.isNotEmpty) {
      try {
        final snapshot = await _dashboard.fetchSnapshot();
        snapshotValues = snapshot.currentValues;
      } catch (_) {
        // These types show "unavailable" rather than a cost-basis fallback.
      }
    }

    final items = accounts
        .map(
          (a) => AccountItem(
            account: a,
            value: resolveCurrentValue(
              account: a,
              ledgerBalance: balances[a.id]?.currentBalance,
              snapshotValue: snapshotValues[a.id],
              latestValuation: valuations[a.id],
            ),
            lifecycle: lifecycle[a.id],
          ),
        )
        .toList();

    return AccountsListModel(items: items);
  }

  Future<GoldAccountDetail> loadGoldDetail(String accountId) async {
    final account = await _accounts.getAccount(accountId);
    final purchases = await _metal.getPurchaseHistory([accountId]);
    String? snapshotValue;
    try {
      final snapshot = await _dashboard.fetchSnapshot();
      snapshotValue = snapshot.currentValues[accountId];
    } catch (_) {}
    final currentValue = resolveCurrentValue(
      account: account,
      snapshotValue: snapshotValue,
    );
    return GoldAccountDetail(
      account: account,
      purchases: purchases,
      currentValue: currentValue,
      pricePerGram: derivePricePerGram(
        accountCurrentValue: currentValue.amount,
        purchases: purchases,
      ),
    );
  }

  Future<List<Account>> fundingCandidates(String currencyCode) async {
    final accounts = await _accounts.getAccounts();
    return accounts
        .where(
          (a) =>
              a.isActive &&
              (a.type == AccountType.cash || a.type == AccountType.bank) &&
              a.currencyCode == currencyCode,
        )
        .toList();
  }

  // ---- guarded mutations ---------------------------------------------

  Future<T> _guard<T>(Future<T> Function() action) async {
    if (_mutating) {
      throw AccountsException('Please wait for the current change to finish.');
    }
    _mutating = true;
    try {
      final result = await action();
      DataChange.instance.ping();
      return result;
    } finally {
      _mutating = false;
    }
  }

  Future<Account> createAccount(AccountFormValues v) =>
      _guard(() => _accounts.createAccount(v));

  Future<Account> updateAccount(String id, AccountFormValues v) =>
      _guard(() => _accounts.updateAccount(id, v));

  Future<void> closeAccount(String id) =>
      _guard(() => _accounts.closeAccount(id));

  Future<void> reopenAccount(String id) =>
      _guard(() => _accounts.reopenAccount(id));

  Future<void> deleteAccount(String id) =>
      _guard(() => _accounts.deleteAccount(id));

  Future<void> addMetalPurchase(String accountId, MetalPurchaseFormValues v) =>
      _guard(() => _metal.addPurchase(accountId, v));

  Future<void> correctMetalPurchase(
    String purchaseId,
    MetalPurchaseFormValues v,
  ) => _guard(() => _metal.correctPurchase(purchaseId, v));

  Future<void> reverseMetalPurchase(String purchaseId) =>
      _guard(() => _metal.reversePurchase(purchaseId));
}
