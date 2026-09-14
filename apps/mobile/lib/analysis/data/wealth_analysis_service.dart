import '../../dashboard/data/dashboard_repository.dart';
import '../../dashboard/logic/dashboard_aggregate.dart';
import '../domain/wealth_analysis.dart';
import '../domain/wealth_target_allocation.dart';
import 'wealth_allocation_targets_repository.dart';

class WealthAnalysisData {
  const WealthAnalysisData({
    required this.aggregate,
    required this.evidence,
    required this.targetPlan,
  });

  final DashboardAggregate aggregate;
  final WealthAnalysisEvidence evidence;
  final WealthTargetPlan targetPlan;

  WealthAnalysisData withTargetPlan(WealthTargetPlan plan) =>
      WealthAnalysisData(
        aggregate: aggregate,
        evidence: evidence,
        targetPlan: plan,
      );
}

abstract interface class WealthAnalysisDataSource {
  Future<WealthAnalysisData> load();
  Future<void> saveTargetPlan(WealthTargetPlan plan);
}

/// Coordinates the existing Dashboard valuation read with the user-owned
/// target-plan repository. It adds no second valuation or conversion path.
class WealthAnalysisService implements WealthAnalysisDataSource {
  WealthAnalysisService({
    DashboardRepository? dashboardRepository,
    WealthAllocationTargetsStore? targetsRepository,
  }) : _dashboard = dashboardRepository ?? DashboardRepository(),
       _targets = targetsRepository ?? WealthAllocationTargetsRepository();

  final DashboardRepository _dashboard;
  final WealthAllocationTargetsStore _targets;

  @override
  Future<WealthAnalysisData> load() async {
    final baseCurrency = await _dashboard.fetchBaseCurrency();
    if (baseCurrency == null) {
      throw DashboardException(DashboardErrorKind.noBaseCurrency);
    }
    final accounts = await _dashboard.fetchAccounts();
    final snapshot = await _dashboard.fetchSnapshot();
    final aggregate = calculateDashboardAggregate(
      baseCurrencyCode: baseCurrency,
      accounts: accounts,
      snapshot: snapshot,
    ).withSnapshotMeta(snapshot);
    final targetPlan = await _targets.load();
    return WealthAnalysisData(
      aggregate: aggregate,
      evidence: buildWealthAnalysisEvidence(aggregate),
      targetPlan: targetPlan,
    );
  }

  @override
  Future<void> saveTargetPlan(WealthTargetPlan plan) => _targets.replace(plan);
}
