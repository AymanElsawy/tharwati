import '../../core/securities_allocation.dart';
import '../data/dashboard_snapshot.dart';

/// Brokerage-only allocation groups, in display order (docs/dashboard.md §2.3).
typedef AllocationGroup = SecuritiesAllocationGroup;
typedef AllocationItem = SecuritiesAllocationItem;

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

  return calculateSecuritiesAllocation(
    alloc.holdings.map(
      (holding) => SecuritiesAllocationValue(
        holding.assetTypeCode,
        holding.marketValueBaseCurrency,
      ),
    ),
  );
}
