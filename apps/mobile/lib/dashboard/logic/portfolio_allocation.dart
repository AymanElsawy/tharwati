import '../../core/decimals.dart';
import '../data/dashboard_snapshot.dart';

/// Brokerage-only allocation groups, in display order (docs/dashboard.md §2.3).
enum AllocationGroup { stocks, etfs, bonds, mutualFunds, cryptocurrency, other }

class AllocationItem {
  const AllocationItem({
    required this.group,
    required this.valueBase,
    required this.percentage,
  });

  final AllocationGroup group;
  final String valueBase; // base-currency decimal string
  final String percentage; // decimal string, 2dp
}

AllocationGroup _groupFor(String assetTypeCode) {
  switch (assetTypeCode) {
    case 'stock':
      return AllocationGroup.stocks;
    case 'etf':
      return AllocationGroup.etfs;
    case 'bond':
      return AllocationGroup.bonds;
    case 'mutual_fund':
      return AllocationGroup.mutualFunds;
    case 'cryptocurrency':
      return AllocationGroup.cryptocurrency;
    default:
      return AllocationGroup.other;
  }
}

/// Aggregates the snapshot's positive Brokerage holdings into groups with
/// percentages that sum to exactly 100 (the last present group absorbs the
/// rounding residual). Returns an empty list when the allocation is not
/// `complete` or there are no positive holdings — the card then shows its
/// unavailable / empty state.
List<AllocationItem> portfolioAllocationItems(
  PortfolioAllocationSnapshot? alloc,
) {
  if (alloc == null || alloc.status != PortfolioAllocationStatus.complete) {
    return const [];
  }

  final totals = <AllocationGroup, String>{};
  for (final holding in alloc.holdings) {
    if (!D.isPositive(holding.marketValueBaseCurrency)) continue;
    final group = _groupFor(holding.assetTypeCode);
    totals[group] = D.add(
      totals[group] ?? '0',
      holding.marketValueBaseCurrency,
    )!;
  }
  if (totals.isEmpty) return const [];

  final ordered = AllocationGroup.values.where(totals.containsKey).toList();
  final grandTotal = D.sum(ordered.map((g) => totals[g]))!;

  final items = <AllocationItem>[];
  var runningPercent = '0';
  for (var i = 0; i < ordered.length; i++) {
    final group = ordered[i];
    final value = totals[group]!;
    final String percentage;
    if (i == ordered.length - 1) {
      percentage = D.subtract('100', runningPercent)!;
    } else {
      percentage =
          D.multiply(D.divide(value, grandTotal, scale: 6), '100') ?? '0';
      final rounded = D.divide(percentage, '1', scale: 2)!;
      runningPercent = D.add(runningPercent, rounded)!;
      items.add(
        AllocationItem(group: group, valueBase: value, percentage: rounded),
      );
      continue;
    }
    items.add(
      AllocationItem(
        group: group,
        valueBase: value,
        percentage: D.divide(percentage, '1', scale: 2)!,
      ),
    );
  }
  return items;
}
