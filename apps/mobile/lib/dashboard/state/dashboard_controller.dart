import 'package:flutter/foundation.dart';

import '../../core/data_change.dart';
import '../data/dashboard_repository.dart';
import '../logic/dashboard_aggregate.dart';
import '../data/dashboard_snapshot.dart';
import '../logic/key_insights.dart';
import '../logic/portfolio_allocation.dart';

enum DashboardStatus { loading, noBaseCurrency, error, ready }

/// Drives the Dashboard screen. Loads once on creation and silently reloads on
/// any [DataChange] ping; a single-flight guard coalesces overlapping loads into
/// one trailing silent refresh (docs/dashboard.md §2.9).
class DashboardController extends ChangeNotifier {
  DashboardController({DashboardRepository? repository})
    : _repo = repository ?? DashboardRepository() {
    DataChange.instance.addListener(_onDataChanged);
    load();
  }

  final DashboardRepository _repo;

  DashboardStatus status = DashboardStatus.loading;
  DashboardAggregate? aggregate;
  List<AllocationItem> allocation = const [];

  /// Raw allocation status from the snapshot — lets the Portfolio Allocation
  /// card tell "no Brokerage holdings" (hide) from "incomplete" (show note).
  PortfolioAllocationStatus? allocationStatus;
  KeyInsight? insight;
  String? errorReason;

  /// True when the most recent completed load was a background refresh — the
  /// net-worth hero uses this to skip replaying its count-up.
  bool lastLoadSilent = false;

  bool _inFlight = false;
  bool _pendingSilentReload = false;

  @override
  void dispose() {
    DataChange.instance.removeListener(_onDataChanged);
    super.dispose();
  }

  void _onDataChanged() => load(silent: true);

  Future<void> load({bool silent = false}) async {
    if (_inFlight) {
      _pendingSilentReload = true;
      return;
    }
    _inFlight = true;
    if (!silent) {
      status = DashboardStatus.loading;
      notifyListeners();
    }

    try {
      final baseCurrency = await _repo.fetchBaseCurrency();
      if (baseCurrency == null) {
        status = DashboardStatus.noBaseCurrency;
        aggregate = null;
        allocation = const [];
        allocationStatus = null;
        insight = null;
      } else {
        final accounts = await _repo.fetchAccounts();
        final snapshot = await _repo.fetchSnapshot();
        final agg = calculateDashboardAggregate(
          baseCurrencyCode: baseCurrency,
          accounts: accounts,
          snapshot: snapshot,
        ).withSnapshotMeta(snapshot);
        aggregate = agg;
        allocation = portfolioAllocationItems(snapshot.portfolioAllocation);
        allocationStatus = snapshot.portfolioAllocation.status;
        insight = keyInsightFor(agg);
        errorReason = null;
        status = DashboardStatus.ready;
      }
    } on DashboardException catch (e) {
      if (e.kind == DashboardErrorKind.noBaseCurrency) {
        status = DashboardStatus.noBaseCurrency;
      } else {
        status = DashboardStatus.error;
        errorReason = e.reason;
      }
    } catch (e) {
      status = DashboardStatus.error;
      errorReason = e.toString();
    } finally {
      lastLoadSilent = silent;
      _inFlight = false;
      notifyListeners();
      if (_pendingSilentReload) {
        _pendingSilentReload = false;
        // Trailing coalesced refresh for changes that landed mid-load.
        load(silent: true);
      }
    }
  }

  Future<void> refresh() => load();
}
