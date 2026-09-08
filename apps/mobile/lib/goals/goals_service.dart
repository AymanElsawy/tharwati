import '../core/data_change.dart';
import 'goal_history.dart';
import 'goal_math.dart';
import 'goal_models.dart';
import 'goals_repository.dart';

/// Thin orchestration over [GoalsRepository] — port of the web
/// `services/goals.service.ts`. Validates form/entry input before it reaches an
/// RPC and pings [DataChange] after every successful mutation so the dashboard
/// Goals card refreshes (the mobile stand-in for the web `tharwati:data-changed`
/// event).
class GoalsService {
  GoalsService([GoalsRepository? repository])
    : _repo = repository ?? GoalsRepository();

  final GoalsRepository _repo;

  /// Every goal summarised, plus each goal's history entries with correction
  /// back-links (port of `loadGoals`).
  Future<GoalsReadModel> loadGoals() async {
    final data = await _repo.list();
    final entriesByGoal = buildGoalHistoryEntries(data.entries);

    final goals = data.goals.map((goal) {
      final summary = toGoalSummary(
        goal,
        (entriesByGoal[goal.id] ?? const []).map((h) => h.entry).toList(),
      );
      if (summary == null) {
        throw StateError(
          'Goal progress is unavailable — stored decimal data is invalid.',
        );
      }
      return summary;
    }).toList();

    return GoalsReadModel(goals: goals, entriesByGoal: entriesByGoal);
  }

  Future<void> saveGoal(GoalFormInput input, {String? id}) async {
    final error = validateGoalInput(input);
    if (error != null) throw GoalActionException(goalValidationMessage(error));
    if (id == null) {
      await _repo.createGoal(input);
    } else {
      await _repo.updateGoal(id, input);
    }
    DataChange.instance.ping();
  }

  Future<void> addGoalEntry(String goalId, GoalEntryInput input) async {
    final error = validateEntryInput(input);
    if (error != null) throw GoalActionException(goalValidationMessage(error));
    await _repo.addEntry(goalId, input);
    DataChange.instance.ping();
  }

  Future<void> correctGoalEntry(
    String entryId, {
    String? amount,
    String? effectiveOn,
    String? note,
  }) async {
    await _repo.correctEntry(
      entryId,
      amount: amount,
      effectiveOn: effectiveOn,
      note: note,
    );
    DataChange.instance.ping();
  }

  Future<void> setGoalStatus(String goalId, String status) async {
    await _repo.setStatus(goalId, status);
    DataChange.instance.ping();
  }

  Future<void> setGoalArchived(String goalId, bool archived) async {
    await _repo.setArchived(goalId, archived);
    DataChange.instance.ping();
  }
}
