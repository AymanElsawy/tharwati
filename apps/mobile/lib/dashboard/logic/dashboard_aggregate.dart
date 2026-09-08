import '../../core/decimals.dart';
import '../data/account_summary.dart';
import '../data/dashboard_snapshot.dart';

/// Asset groups shown on the dashboard, in display order. `certificates` has no
/// supported account type today and is always zero (kept for parity).
enum AssetGroup {
  cashAndBank,
  brokerage,
  goldAndSilver,
  realEstate,
  business,
  certificates,
  other,
}

enum AggregateStatus { complete, incomplete }

/// Result of [calculateDashboardAggregate] — the net-worth hero, assets
/// breakdown, and key-insights all read from this one object.
class DashboardAggregate {
  const DashboardAggregate({
    required this.baseCurrencyCode,
    required this.status,
    required this.totalAssets,
    required this.totalLiabilities,
    required this.netWorth,
    required this.assetBreakdown,
    required this.accountCount,
    required this.unavailablePairs,
    required this.unavailableSources,
    this.asOf,
    this.freshness,
  });

  final String baseCurrencyCode;
  final AggregateStatus status;

  /// Base-currency decimal strings, or null when [status] is incomplete — a
  /// partial total is never shown (docs/dashboard.md §2.2).
  final String? totalAssets;
  final String? totalLiabilities;
  final String? netWorth;

  /// Per-group base-currency totals, or all-null when incomplete.
  final Map<AssetGroup, String?> assetBreakdown;

  final int accountCount;
  final List<String> unavailablePairs;
  final List<String> unavailableSources;

  final DateTime? asOf;
  final SnapshotFreshness? freshness;

  bool get isEmpty => accountCount == 0;

  DashboardAggregate withSnapshotMeta(DashboardSnapshot snapshot) =>
      DashboardAggregate(
        baseCurrencyCode: baseCurrencyCode,
        status: status,
        totalAssets: totalAssets,
        totalLiabilities: totalLiabilities,
        netWorth: netWorth,
        assetBreakdown: assetBreakdown,
        accountCount: accountCount,
        unavailablePairs: unavailablePairs,
        unavailableSources: unavailableSources,
        asOf: snapshot.asOf,
        freshness: snapshot.freshness,
      );
}

AssetGroup? _assetGroup(AccountSummary account) {
  switch (account.accountTypeCode) {
    case 'cash':
      return AssetGroup.cashAndBank;
    case 'bank':
      return account.bankSubtype == 'credit' ? null : AssetGroup.cashAndBank;
    case 'brokerage':
      return AssetGroup.brokerage;
    case 'gold':
      return AssetGroup.goldAndSilver;
    case 'real_estate':
      return AssetGroup.realEstate;
    case 'business':
      return AssetGroup.business;
    case 'other':
      return AssetGroup.other;
    default:
      return AssetGroup.other;
  }
}

/// Decimal-safe base-currency aggregation over the Edge snapshot — a direct port
/// of the web's `calculateDashboardAggregate`.
///
/// All-or-nothing: if any active account's value or a required FX rate is
/// missing, [DashboardAggregate.status] is `incomplete` and every total is null.
DashboardAggregate calculateDashboardAggregate({
  required String baseCurrencyCode,
  required List<AccountSummary> accounts,
  required DashboardSnapshot snapshot,
}) {
  final active = accounts.where((a) => a.isActive).toList();
  final breakdown = <AssetGroup, String>{
    for (final group in AssetGroup.values) group: '0',
  };
  final unavailablePairs = <String>{};
  final unavailableSources = <String>[];

  String? convert(String amount, String currencyCode, String source) {
    if (currencyCode == baseCurrencyCode) return amount;
    final rate = snapshot.rates['$currencyCode/$baseCurrencyCode'];
    if (rate == null) {
      unavailablePairs.add('$currencyCode/$baseCurrencyCode');
      unavailableSources.add(source);
      return null;
    }
    final converted = D.multiply(amount, rate);
    if (converted == null) {
      unavailableSources.add(source);
      return null;
    }
    return converted;
  }

  for (final account in active) {
    final group = _assetGroup(account);
    if (group == null) continue;
    final hasKey = snapshot.currentValues.containsKey(account.id);
    final value = snapshot.currentValues[account.id];
    if (!hasKey || value == null) {
      unavailableSources.add(account.name);
      continue;
    }
    final converted = convert(value, account.currencyCode, account.name);
    if (converted == null) continue;
    breakdown[group] = D.add(breakdown[group], converted)!;
  }

  var totalLiabilities = '0';
  for (final account in active) {
    if (account.accountTypeCode != 'bank' || account.bankSubtype != 'credit') {
      continue;
    }
    final balance = snapshot.accountBalances[account.id];
    final limit = account.creditCardLimit;
    if (limit == null || balance == null) {
      unavailableSources.add(account.name);
      continue;
    }
    final amountDue = D.subtract(limit, balance);
    if (amountDue == null || (D.compare(amountDue, '0') ?? -1) < 0) {
      unavailableSources.add(account.name);
      continue;
    }
    final converted = convert(amountDue, account.currencyCode, account.name);
    if (converted == null) continue;
    totalLiabilities = D.add(totalLiabilities, converted)!;
  }

  if (unavailableSources.isNotEmpty) {
    return DashboardAggregate(
      baseCurrencyCode: baseCurrencyCode,
      status: AggregateStatus.incomplete,
      totalAssets: null,
      totalLiabilities: null,
      netWorth: null,
      assetBreakdown: {for (final g in AssetGroup.values) g: null},
      accountCount: active.length,
      unavailablePairs: unavailablePairs.toList(),
      unavailableSources: unavailableSources,
    );
  }

  final totalAssets = D.sum(AssetGroup.values.map((g) => breakdown[g])) ?? '0';
  return DashboardAggregate(
    baseCurrencyCode: baseCurrencyCode,
    status: AggregateStatus.complete,
    totalAssets: totalAssets,
    totalLiabilities: totalLiabilities,
    netWorth: D.subtract(totalAssets, totalLiabilities),
    assetBreakdown: {for (final g in AssetGroup.values) g: breakdown[g]},
    accountCount: active.length,
    unavailablePairs: const [],
    unavailableSources: const [],
  );
}
