import '../../core/decimals.dart';

/// Parsed `dashboard-valuation` Edge Function payload. Direct port of the web's
/// `parseDashboardValuationSnapshot` — same strict validation, so a malformed
/// snapshot throws rather than rendering wrong numbers.
class DashboardSnapshot {
  const DashboardSnapshot({
    required this.asOf,
    required this.expiresAt,
    required this.freshness,
    required this.currentValues,
    required this.accountBalances,
    required this.rates,
    required this.unavailableSources,
    required this.portfolioAllocation,
  });

  final DateTime asOf;
  final DateTime expiresAt;
  final SnapshotFreshness freshness;

  /// accountId -> current value in the account's *native* currency (null = could
  /// not be valued).
  final Map<String, String?> currentValues;

  /// accountId -> ledger-projected balance (native currency).
  final Map<String, String> accountBalances;

  /// "FROM/TO" -> rate (null = unavailable).
  final Map<String, String?> rates;

  /// Account names the server could not value.
  final List<String> unavailableSources;

  final PortfolioAllocationSnapshot portfolioAllocation;

  static DashboardSnapshot parse(Object? value) {
    if (value is! Map) {
      throw const FormatException('Dashboard valuation snapshot is invalid');
    }
    final map = value.cast<String, dynamic>();

    final asOf = DateTime.tryParse('${map['asOf']}');
    final expiresAt = DateTime.tryParse('${map['expiresAt']}');
    final freshness = _freshness(map['freshness']);
    final currentValues = _decimalMap(map['currentValues'], nullable: true);
    final accountBalances = _decimalMap(
      map['accountBalances'],
      nullable: false,
    );
    final rates = _decimalMap(map['rates'], nullable: true);
    final sourcesRaw = map['unavailableSources'];
    final allocation = map.containsKey('portfolioAllocation')
        ? PortfolioAllocationSnapshot._parse(map['portfolioAllocation'])
        : const PortfolioAllocationSnapshot(
            status: PortfolioAllocationStatus.incomplete,
            holdings: [],
          );

    if (asOf == null ||
        expiresAt == null ||
        freshness == null ||
        currentValues == null ||
        accountBalances == null ||
        rates == null ||
        allocation == null ||
        sourcesRaw is! List ||
        sourcesRaw.any((s) => s is! String)) {
      throw const FormatException('Dashboard valuation snapshot is invalid');
    }

    return DashboardSnapshot(
      asOf: asOf,
      expiresAt: expiresAt,
      freshness: freshness,
      currentValues: currentValues,
      accountBalances: accountBalances.map((k, v) => MapEntry(k, v!)),
      rates: rates,
      unavailableSources: sourcesRaw.cast<String>(),
      portfolioAllocation: allocation,
    );
  }

  static SnapshotFreshness? _freshness(Object? raw) => switch (raw) {
    'fresh' => SnapshotFreshness.fresh,
    'stale' => SnapshotFreshness.stale,
    'unavailable' => SnapshotFreshness.unavailable,
    _ => null,
  };

  static Map<String, String?>? _decimalMap(
    Object? raw, {
    required bool nullable,
  }) {
    if (raw is! Map) return null;
    final result = <String, String?>{};
    for (final entry in raw.entries) {
      final item = entry.value;
      if (item == null) {
        if (!nullable) return null;
        result['${entry.key}'] = null;
        continue;
      }
      final normalized = D.normalize('$item');
      if (normalized == null) return null;
      result['${entry.key}'] = normalized;
    }
    return result;
  }
}

enum SnapshotFreshness { fresh, stale, unavailable }

enum PortfolioAllocationStatus { complete, incomplete }

class PortfolioAllocationSnapshot {
  const PortfolioAllocationSnapshot({
    required this.status,
    required this.holdings,
  });

  final PortfolioAllocationStatus status;
  final List<AllocationHolding> holdings;

  static PortfolioAllocationSnapshot? _parse(Object? value) {
    if (value is! Map) return null;
    final status = switch (value['status']) {
      'complete' => PortfolioAllocationStatus.complete,
      'incomplete' => PortfolioAllocationStatus.incomplete,
      _ => null,
    };
    final rawHoldings = value['holdings'];
    if (status == null || rawHoldings is! List) return null;
    final holdings = <AllocationHolding>[];
    for (final holding in rawHoldings) {
      if (holding is! Map) return null;
      final assetId = holding['assetId'];
      final assetTypeCode = holding['assetTypeCode'];
      final marketValue = D.normalize('${holding['marketValueBaseCurrency']}');
      if (assetId is! String ||
          assetTypeCode is! String ||
          marketValue == null) {
        return null;
      }
      holdings.add(
        AllocationHolding(
          assetId: assetId,
          assetTypeCode: assetTypeCode,
          marketValueBaseCurrency: marketValue,
        ),
      );
    }
    return PortfolioAllocationSnapshot(status: status, holdings: holdings);
  }
}

class AllocationHolding {
  const AllocationHolding({
    required this.assetId,
    required this.assetTypeCode,
    required this.marketValueBaseCurrency,
  });

  final String assetId;
  final String assetTypeCode;
  final String marketValueBaseCurrency;
}
