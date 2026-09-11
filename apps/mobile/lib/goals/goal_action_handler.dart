import 'package:flutter/material.dart';

import '../i18n/app_language.dart';
import '../i18n/goals_copy.dart';
import 'goal_actions_sheet.dart';
import 'goal_entry_sheet.dart';
import 'goal_form_sheet.dart';
import 'goal_models.dart';
import 'goals_controller.dart';
import 'widgets/goal_sheet.dart';

/// The most recent entry that can still be corrected or reversed: a
/// progress/withdrawal that no reversal already points at.
GoalHistoryEntry? lastCorrectableEntry(List<GoalHistoryEntry> history) {
  final candidates =
      history
          .where(
            (h) =>
                h.entry.entryType != 'reversal' && h.reversedByEntryId == null,
          )
          .toList()
        ..sort((a, b) => b.entry.createdAt.compareTo(a.entry.createdAt));
  return candidates.isEmpty ? null : candidates.first;
}

/// Opens the Add/Edit goal sheet.
Future<void> openGoalForm(
  BuildContext context,
  GoalsController controller, {
  GoalSummary? goal,
  String defaultCurrency = 'EGP',
}) {
  controller.clearActionError();
  return showGoalSheet<bool>(
    context,
    builder: (_) => GoalFormSheet(
      controller: controller,
      goal: goal,
      defaultCurrency: defaultCurrency,
    ),
  );
}

/// Opens the overflow sheet for [summary] and carries out whatever it returns
/// (entry sheets, reverse confirm, status/archive). All Goals writes funnel
/// through here so error/busy handling is uniform.
Future<void> openGoalActions(
  BuildContext context,
  GoalsController controller,
  GoalSummary summary,
) async {
  controller.clearActionError();
  final history = controller.historyFor(summary.goal.id);
  final correctable = lastCorrectableEntry(history);
  final copy = GoalsCopy.of(AppLanguageScope.of(context).language);

  final action = await showGoalSheet<GoalAction>(
    context,
    builder: (_) => GoalActionsSheet(
      summary: summary,
      hasCorrectableEntry: correctable != null,
    ),
  );
  if (action == null || !context.mounted) return;

  switch (action) {
    case GoalAction.addProgress:
      await _entry(context, controller, summary.goal, GoalEntryMode.progress);
    case GoalAction.withdraw:
      await _entry(context, controller, summary.goal, GoalEntryMode.withdrawal);
    case GoalAction.correctLast:
      if (correctable != null) {
        await _entry(
          context,
          controller,
          summary.goal,
          GoalEntryMode.correct,
          entry: correctable,
        );
      }
    case GoalAction.reverseLast:
      if (correctable != null) {
        final ok = await _confirm(context, copy.reverseTitle, copy.reverseBody);
        if (ok) {
          await controller.run(
            (s) => s.correctGoalEntry(correctable.id, note: copy.reversalNote),
          );
        }
      }
    case GoalAction.complete:
      await controller.run(
        (s) => s.setGoalStatus(summary.goal.id, 'completed'),
      );
    case GoalAction.cancel:
      final ok = await _confirm(
        context,
        copy.cancelGoalTitle,
        copy.cancelGoalBody,
      );
      if (ok) {
        await controller.run(
          (s) => s.setGoalStatus(summary.goal.id, 'cancelled'),
        );
      }
    case GoalAction.reopen:
      await controller.run((s) => s.setGoalStatus(summary.goal.id, 'active'));
    case GoalAction.archive:
      await controller.run((s) => s.setGoalArchived(summary.goal.id, true));
    case GoalAction.unarchive:
      await controller.run((s) => s.setGoalArchived(summary.goal.id, false));
  }
}

Future<void> _entry(
  BuildContext context,
  GoalsController controller,
  Goal goal,
  GoalEntryMode mode, {
  GoalHistoryEntry? entry,
}) {
  controller.clearActionError();
  return showGoalSheet<bool>(
    context,
    builder: (_) => GoalEntrySheet(
      controller: controller,
      goal: goal,
      mode: mode,
      entry: entry,
    ),
  );
}

Future<bool> _confirm(BuildContext context, String title, String body) async {
  final copy = GoalsCopy.of(AppLanguageScope.of(context).language);
  return await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(title),
          content: Text(body),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: Text(copy.keepAsIs),
            ),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: Text(copy.continueLabel),
            ),
          ],
        ),
      ) ??
      false;
}
