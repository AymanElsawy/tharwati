import 'package:flutter/foundation.dart';

import 'goal_math.dart';
import 'goal_models.dart';
import 'goals_repository.dart';
import 'goals_service.dart';

enum GoalsStatus { loading, error, ready }

/// Drives the Goals page (Flow 5). Owns the read model, the Current/Archived
/// filter, and a `busy`/`actionError` wrapper for mutations; after any write it
/// reloads and lets [GoalsService] ping the dashboard. It is the *source* of
/// goal changes, so it does not itself listen to `DataChange`.
class GoalsController extends ChangeNotifier {
  GoalsController({GoalsService? service})
    : _service = service ?? GoalsService() {
    load();
  }

  final GoalsService _service;

  GoalsStatus status = GoalsStatus.loading;
  GoalsReadModel? model;
  bool showArchived = false;
  bool busy = false;
  String? actionError;

  String get today => goalToday();

  int get currentCount =>
      model?.goals.where((g) => !g.goal.isArchived).length ?? 0;
  int get archivedCount =>
      model?.goals.where((g) => g.goal.isArchived).length ?? 0;

  /// Goals for the active tab, active ones first (stable) — port of the web
  /// `visible` memo.
  List<GoalSummary> get visible {
    final all = model?.goals ?? const [];
    final filtered = all
        .where((g) => showArchived ? g.goal.isArchived : !g.goal.isArchived)
        .toList();
    filtered.sort((a, b) {
      if (a.goal.isActive && !b.goal.isActive) return -1;
      if (!a.goal.isActive && b.goal.isActive) return 1;
      return 0;
    });
    return filtered;
  }

  GoalSummary? goalById(String id) => model?.goalById(id);

  List<GoalHistoryEntry> historyFor(String goalId) =>
      model?.entriesByGoal[goalId] ?? const [];

  Future<void> load() async {
    status = GoalsStatus.loading;
    notifyListeners();
    try {
      model = await _service.loadGoals();
      status = GoalsStatus.ready;
    } catch (_) {
      model = null;
      status = GoalsStatus.error;
    }
    notifyListeners();
  }

  void setShowArchived(bool value) {
    if (showArchived == value) return;
    showArchived = value;
    notifyListeners();
  }

  void clearActionError() {
    if (actionError == null) return;
    actionError = null;
    notifyListeners();
  }

  /// Runs a mutation with a shared busy flag + friendly error surface, then
  /// reloads. Returns true on success so callers can close a sheet.
  Future<bool> run(Future<void> Function(GoalsService s) action) async {
    busy = true;
    actionError = null;
    notifyListeners();
    try {
      await action(_service);
      await load();
      return true;
    } on GoalActionException catch (e) {
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
}
