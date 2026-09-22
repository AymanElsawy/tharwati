import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  final actions = File('lib/goals/goal_actions_sheet.dart').readAsStringSync();
  final handler = File('lib/goals/goal_action_handler.dart').readAsStringSync();
  final form = File('lib/goals/goal_form_sheet.dart').readAsStringSync();
  final service = File('lib/goals/goals_service.dart').readAsStringSync();

  test('Edit Goal is the first overflow action for every lifecycle state', () {
    final edit = actions.indexOf('row(Icons.edit_outlined, copy.editGoal, GoalAction.edit)');
    final progress = actions.indexOf('row(Icons.add, copy.addProgress, GoalAction.addProgress)');
    expect(edit, greaterThanOrEqualTo(0));
    expect(edit, lessThan(progress));
    expect(actions.indexOf('row(Icons.edit_outlined'), lessThan(actions.indexOf('if (goal.isMutable)')));
  });

  test('selecting Edit opens the existing form with the selected summary', () {
    expect(handler, contains('case GoalAction.edit:'));
    expect(handler, contains('await openGoalForm(context, controller, goal: summary);'));
    expect(form, contains('final GoalSummary? goal;'));
    expect(form, contains('text: widget.goal?.goal.name ?? \'\''));
  });

  test('edit saves through the existing update path and keeps history currency lock', () {
    expect(form, contains('s.saveGoal(input, id: widget.goal?.goal.id)'));
    expect(service, contains('await _repo.updateGoal(id, input)'));
    expect(form, contains('widget.isEditing && isGoalCurrencyLocked(widget.goal!.hasHistory)'));
    expect(form, contains('if (!widget.isEditing) ...['));
  });
}
