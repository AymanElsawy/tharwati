import 'package:flutter/foundation.dart';

import '../../core/data_change.dart';
import '../../goals/goal_models.dart';
import '../../goals/goals_repository.dart';

enum GoalsCardStatus { loading, error, ready }

/// The dashboard "Goals" card loads independently and its failures stay isolated
/// to the card (docs/dashboard.md §3.1).
class DashboardGoalsController extends ChangeNotifier {
  DashboardGoalsController({GoalsRepository? repository})
    : _repo = repository ?? GoalsRepository() {
    DataChange.instance.addListener(_reload);
    load();
  }

  final GoalsRepository _repo;

  GoalsCardStatus status = GoalsCardStatus.loading;
  DashboardGoalsModel? model;

  @override
  void dispose() {
    DataChange.instance.removeListener(_reload);
    super.dispose();
  }

  void _reload() => load();

  Future<void> load() async {
    status = GoalsCardStatus.loading;
    notifyListeners();
    try {
      model = await _repo.listActiveGoalSummaries(limit: 3);
      status = GoalsCardStatus.ready;
    } catch (_) {
      model = null;
      status = GoalsCardStatus.error;
    }
    notifyListeners();
  }
}
