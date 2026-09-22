import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  final actions = File('lib/goals/goal_actions_sheet.dart').readAsStringSync();
  final handler = File('lib/goals/goal_action_handler.dart').readAsStringSync();
  final detail = File('lib/goals/goal_detail_page.dart').readAsStringSync();
  final repository = File('lib/goals/goals_repository.dart').readAsStringSync();
  final service = File('lib/goals/goals_service.dart').readAsStringSync();

  test('Delete Goal is eligible only without history and remains near the bottom', () {
    expect(actions, contains('if (!summary.hasHistory)'));
    expect(actions, contains('copy.deleteGoal'));
    expect(actions.indexOf('copy.editGoal'), lessThan(actions.indexOf('copy.deleteGoal')));
    expect(actions.indexOf('copy.deleteGoal'), lessThan(actions.indexOf('return GoalSheet')));
  });

  test('delete requires confirmation and uses the existing controller refresh path', () {
    expect(handler, contains('case GoalAction.delete:'));
    expect(handler, contains('copy.deleteGoalTitle'));
    expect(handler, contains('copy.deleteGoalBody'));
    expect(handler, contains('(s) => s.deleteGoal(summary.goal.id)'));
    expect(repository, contains("_rpc('delete_goal', {'p_goal_id': goalId})"));
    expect(service, contains('await _repo.deleteGoal(goalId)'));
    expect(service, contains('DataChange.instance.ping()'));
  });

  test('successful delete safely leaves Goal detail only', () {
    expect(handler, contains('deleted && leaveOnDelete && context.mounted'));
    expect(handler, contains('Navigator.of(context).pop()'));
    expect(detail, contains('leaveOnDelete: true'));
  });
}
