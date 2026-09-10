import 'package:flutter/material.dart';

import '../theme/tokens.dart';
import '../widgets/primary_button.dart';
import 'goal_models.dart';
import 'widgets/goal_money.dart';
import 'widgets/goal_sheet.dart';

/// Result of the Flow 5 overflow sheet (screen 22). The detail page performs the
/// mutation so all Goals writes stay on one path.
enum GoalAction {
  addProgress,
  withdraw,
  correctLast,
  reverseLast,
  complete,
  cancel,
  reopen,
  archive,
  unarchive,
}

/// The bottom sheet of goal actions. "Add progress" / "Withdraw" also live on
/// the card; everything else collapses here (canvas note on screen 22).
class GoalActionsSheet extends StatelessWidget {
  const GoalActionsSheet({
    super.key,
    required this.summary,
    required this.hasCorrectableEntry,
  });

  final GoalSummary summary;
  final bool hasCorrectableEntry;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final goal = summary.goal;
    final rows = <Widget>[];

    void row(
      IconData icon,
      String label,
      GoalAction action, {
      bool danger = false,
      bool enabled = true,
    }) {
      rows.add(
        _ActionRow(
          icon: icon,
          label: label,
          color: danger ? c.negative : c.ink,
          enabled: enabled,
          onTap: () => Navigator.of(context).pop(action),
        ),
      );
    }

    if (goal.isMutable) {
      row(Icons.add, 'Add progress', GoalAction.addProgress);
      row(Icons.south, 'Withdraw from goal', GoalAction.withdraw);
      row(
        Icons.undo,
        'Correct last entry',
        GoalAction.correctLast,
        enabled: hasCorrectableEntry,
      );
      row(
        Icons.redo,
        'Reverse last entry',
        GoalAction.reverseLast,
        enabled: hasCorrectableEntry,
      );
      row(Icons.check, 'Mark complete', GoalAction.complete);
      row(Icons.inventory_2_outlined, 'Archive', GoalAction.archive);
      row(Icons.close, 'Cancel goal', GoalAction.cancel, danger: true);
    } else {
      if (!goal.isActive) {
        row(Icons.refresh, 'Reopen goal', GoalAction.reopen);
      }
      if (goal.isArchived) {
        row(Icons.unarchive_outlined, 'Unarchive', GoalAction.unarchive);
      } else {
        row(Icons.inventory_2_outlined, 'Archive', GoalAction.archive);
      }
    }

    return GoalSheet(
      title: goal.name,
      subtitle: null,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: GoalMoney(
            amount: summary.fundedAmount,
            currencyCode: goal.currencyCode,
            style: TextStyle(color: c.inkMuted, fontSize: 12),
          ),
        ),
        ...rows,
        const SizedBox(height: 8),
        Text(
          'Add progress and Withdraw stay on the card; everything else collapses '
          'here. Nothing is ever deleted — archived goals keep their full '
          'history.',
          style: TextStyle(color: c.disabledFg, fontSize: 11, height: 1.5),
        ),
        const SizedBox(height: 12),
        NeutralButton(
          label: 'Close',
          onPressed: () => Navigator.of(context).pop(),
        ),
      ],
    );
  }
}

class _ActionRow extends StatelessWidget {
  const _ActionRow({
    required this.icon,
    required this.label,
    required this.color,
    required this.enabled,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Opacity(
      opacity: enabled ? 1 : 0.4,
      child: InkWell(
        onTap: enabled ? onTap : null,
        child: Container(
          constraints: const BoxConstraints(minHeight: AppSizes.button),
          padding: const EdgeInsets.symmetric(horizontal: 4),
          decoration: BoxDecoration(
            border: Border(
              top: BorderSide(color: c.line.withValues(alpha: 0.6)),
            ),
          ),
          child: Row(
            children: [
              Icon(
                icon,
                size: 20,
                color: color == c.negative ? color : c.inkMuted,
              ),
              const SizedBox(width: 12),
              Text(
                label,
                style: TextStyle(
                  color: color,
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
