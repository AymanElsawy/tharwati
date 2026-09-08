import 'package:supabase_flutter/supabase_flutter.dart';

import 'goal_math.dart';
import 'goal_models.dart';

/// Raised when a Goals mutation RPC fails. [message] is already user-facing —
/// port of the web `goalErrorMessage` mapping (components/goal-error-message.ts).
class GoalActionException implements Exception {
  GoalActionException(this.message);
  final String message;
  @override
  String toString() => message;
}

/// Reads and mutates the authenticated user's goals. Reads hit the RLS-guarded
/// tables directly; every write goes through a `security definer` RPC that
/// derives ownership from `auth.uid()` and enforces the lifecycle/amount rules
/// (supabase/migrations/20260829130000_add_goals_mvp.sql).
class GoalsRepository {
  GoalsRepository([SupabaseClient? client])
    : _client = client ?? Supabase.instance.client;

  final SupabaseClient _client;

  static const _goalSelect =
      'id,user_id,name,goal_type,custom_type_name,target_amount::text,'
      'currency_code,target_date,status,archived_at,created_at,updated_at';
  static const _entrySelect =
      'id,goal_id,user_id,entry_type,amount::text,effective_on,note,'
      'reverses_entry_id,replacement_for_entry_id,created_at';

  String get _userId => _client.auth.currentUser!.id;

  // ---- reads -------------------------------------------------------------

  /// Every goal (any status, archived or not) plus every progress entry, newest
  /// effective date first — port of the web `goalsRepository.list`.
  Future<({List<Goal> goals, List<GoalProgressEntry> entries})> list() async {
    final goalRows = await _client
        .from('goals')
        .select(_goalSelect)
        .eq('user_id', _userId)
        .order('created_at', ascending: false);

    final entryRows = await _client
        .from('goal_progress_entries')
        .select(_entrySelect)
        .eq('user_id', _userId)
        .order('effective_on', ascending: false)
        .order('created_at', ascending: false);

    return (
      goals: (goalRows as List)
          .map((r) => Goal.fromRow((r as Map).cast<String, dynamic>()))
          .toList(),
      entries: (entryRows as List)
          .map(
            (r) =>
                GoalProgressEntry.fromRow((r as Map).cast<String, dynamic>()),
          )
          .toList(),
    );
  }

  /// Dashboard "Goals" card model — port of `listActiveSummaries`: at most
  /// [limit] active, unarchived goals ordered by target date (undated last),
  /// oldest creation time as the tie-break, plus a `hasAnyGoals` count.
  Future<DashboardGoalsModel> listActiveGoalSummaries({int limit = 3}) async {
    final goalRows = await _client
        .from('goals')
        .select(_goalSelect)
        .eq('user_id', _userId)
        .eq('status', 'active')
        .isFilter('archived_at', null)
        .order('target_date', ascending: true, nullsFirst: false)
        .order('created_at', ascending: true)
        .limit(limit);

    final countResult = await _client
        .from('goals')
        .select('id')
        .eq('user_id', _userId)
        .count(CountOption.exact);
    final hasAnyGoals = countResult.count > 0;

    final goals = (goalRows as List)
        .map((r) => Goal.fromRow((r as Map).cast<String, dynamic>()))
        .toList();
    if (goals.isEmpty) {
      return DashboardGoalsModel(goals: const [], hasAnyGoals: hasAnyGoals);
    }

    final entryRows = await _client
        .from('goal_progress_entries')
        .select(_entrySelect)
        .eq('user_id', _userId)
        .inFilter('goal_id', goals.map((g) => g.id).toList())
        .order('created_at', ascending: true);

    final entriesByGoal = <String, List<GoalProgressEntry>>{};
    for (final row in entryRows as List) {
      final entry = GoalProgressEntry.fromRow(
        (row as Map).cast<String, dynamic>(),
      );
      (entriesByGoal[entry.goalId] ??= []).add(entry);
    }

    final summaries = <GoalSummary>[];
    for (final goal in goals) {
      final summary = toGoalSummary(goal, entriesByGoal[goal.id] ?? const []);
      if (summary == null) {
        throw StateError(
          'Goal progress is unavailable — stored decimal data is invalid.',
        );
      }
      summaries.add(summary);
    }

    return DashboardGoalsModel(goals: summaries, hasAnyGoals: hasAnyGoals);
  }

  // ---- writes (RPCs) ---------------------------------------------------

  Future<String> createGoal(GoalFormInput input) => _rpc('create_goal', {
    'p_name': input.name.trim(),
    'p_goal_type': input.goalType,
    'p_custom_type_name': showsCustomGoalType(input.goalType)
        ? input.customTypeName?.trim()
        : null,
    'p_target_amount': input.targetAmount,
    'p_currency_code': input.currencyCode,
    'p_target_date': _blankToNull(input.targetDate),
    'p_saved_so_far': _blankToNull(input.savedSoFar),
    'p_saved_on': _blankToNull(input.savedOn),
  });

  Future<void> updateGoal(String id, GoalFormInput input) =>
      _rpc('update_goal', {
        'p_goal_id': id,
        'p_name': input.name.trim(),
        'p_goal_type': input.goalType,
        'p_custom_type_name': showsCustomGoalType(input.goalType)
            ? input.customTypeName?.trim()
            : null,
        'p_target_amount': input.targetAmount,
        'p_currency_code': input.currencyCode,
        'p_target_date': _blankToNull(input.targetDate),
      });

  Future<void> addEntry(String goalId, GoalEntryInput input) =>
      _rpc('add_goal_progress_entry', {
        'p_goal_id': goalId,
        'p_entry_type': input.entryType,
        'p_amount': input.amount,
        'p_effective_on': input.effectiveOn,
        'p_note': _blankToNull(input.note),
      });

  /// A bare reversal ([amount] null) or a correction with an explicit
  /// replacement (both [amount] and [effectiveOn] set).
  Future<void> correctEntry(
    String entryId, {
    String? amount,
    String? effectiveOn,
    String? note,
  }) => _rpc('correct_goal_progress_entry', {
    'p_entry_id': entryId,
    'p_replacement_amount': _blankToNull(amount),
    'p_replacement_effective_on': _blankToNull(effectiveOn),
    'p_note': _blankToNull(note),
  });

  Future<void> setStatus(String goalId, String status) =>
      _rpc('set_goal_status', {'p_goal_id': goalId, 'p_status': status});

  Future<void> setArchived(String goalId, bool archived) =>
      _rpc('set_goal_archived', {'p_goal_id': goalId, 'p_archived': archived});

  Future<String> _rpc(String fn, Map<String, dynamic> params) async {
    try {
      final result = await _client.rpc(fn, params: params);
      return result is String ? result : '';
    } on PostgrestException catch (e) {
      throw GoalActionException(_friendly(e.message));
    } catch (_) {
      throw GoalActionException('Something went wrong. Please try again.');
    }
  }

  static Object? _blankToNull(String? v) =>
      (v == null || v.trim().isEmpty) ? null : v.trim();

  /// Maps the RPC `raise exception` texts to friendly copy (web parity).
  static String _friendly(String message) {
    if (message.contains('Withdrawal exceeds funded amount')) {
      return 'That withdrawal is more than the goal has funded.';
    }
    if (message.contains('Goal must be active and unarchived')) {
      return 'Reopen and unarchive the goal before changing its progress.';
    }
    if (message.contains('currency is locked')) {
      return 'The currency is locked once a goal has progress history.';
    }
    if (message.contains('Entry already reversed')) {
      return 'That entry has already been corrected or reversed.';
    }
    if (message.contains('Correction would make funded amount negative')) {
      return 'That change would push the funded amount below zero.';
    }
    if (message.contains('date cannot be in the future')) {
      return 'The date can’t be in the future.';
    }
    return 'Something went wrong. Please try again.';
  }
}
