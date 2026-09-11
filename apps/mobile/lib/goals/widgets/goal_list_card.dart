import 'package:flutter/material.dart';

import '../../core/decimals.dart';
import '../../core/money_format.dart';
import '../../i18n/app_language.dart';
import '../../i18n/goals_copy.dart';
import '../../theme/tokens.dart';
import '../goal_models.dart';
import 'goal_money.dart';
import 'goal_progress_bar.dart';
import 'goal_sheet.dart';
import 'goal_status_pill.dart';
import 'goal_type_visual.dart';

/// One goal on the Goals list (Flow 5 screens 19/20). Tapping the card opens the
/// detail page; active goals also get inline Add progress / Withdraw / overflow.
class GoalListCard extends StatelessWidget {
  const GoalListCard({
    super.key,
    required this.summary,
    required this.today,
    required this.onTap,
    this.onAddProgress,
    this.onWithdraw,
    this.onOverflow,
  });

  final GoalSummary summary;
  final String today;
  final VoidCallback onTap;
  final VoidCallback? onAddProgress;
  final VoidCallback? onWithdraw;
  final VoidCallback? onOverflow;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final copy = GoalsCopy.of(AppLanguageScope.of(context).language);
    final goal = summary.goal;
    final overdue = summary.isOverdue(today);
    final overTarget = D.isPositive(summary.surplusAmount);
    // The card keeps the real percentage in its caption. The summary's capped
    // display value is only used by the visual bar.
    final fill = (double.tryParse(summary.displayPercent) ?? 0) / 100;
    final muted = goal.isArchived || !goal.isActive;

    final subtitleParts = <String>[
      copy.type(goal.goalType, custom: goal.customTypeName),
    ];
    if (overdue) {
      subtitleParts.add(
        copy.daysOverdue(_daysOverdue(goal.targetDate!, today)),
      );
    } else if (goal.targetDate != null) {
      subtitleParts.add(copy.targetDate(goal.targetDate!));
    } else if (goal.isActive) {
      subtitleParts.add(copy.noTargetDate);
    }

    String caption;
    final pct = MoneyFormat.percent(summary.progressPercent);
    if (overTarget) {
      caption = copy.overTarget(
        pct,
        goalMoney(summary.surplusAmount, goal.currencyCode),
      );
    } else if (goal.isActive) {
      final toGo = D.subtract(goal.targetAmount, summary.fundedAmount);
      caption = (toGo != null && D.isPositive(toGo))
          ? copy.toGo(pct, goalMoney(toGo, goal.currencyCode))
          : copy.funded(pct);
    } else {
      caption = copy.funded(pct);
    }

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.card),
      child: GoalSurfaceCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                GoalTypeIcon(goalType: goal.goalType, muted: muted),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        goal.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: muted ? c.inkMuted : c.ink,
                          fontSize: 19,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        subtitleParts.join(' · '),
                        style: TextStyle(
                          color: overdue ? c.negative : c.inkMuted,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                GoalStatusPill(status: goal.status, overdue: overdue),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                GoalMoney(
                  amount: summary.fundedAmount,
                  currencyCode: goal.currencyCode,
                  style: TextStyle(
                    color: muted ? c.inkMuted : c.ink,
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const Spacer(),
                Text(
                  copy.ofTarget(
                    MoneyFormat.money(goal.targetAmount, goal.currencyCode),
                  ),
                  textDirection: TextDirection.ltr,
                  style: TextStyle(color: c.inkMuted, fontSize: 12),
                ),
              ],
            ),
            const SizedBox(height: 8),
            GoalProgressBar(fill: fill, muted: muted, height: 10),
            const SizedBox(height: 7),
            Text(
              caption,
              style: TextStyle(
                color: overTarget ? c.accent : c.inkMuted,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
            if (goal.isMutable &&
                (onAddProgress != null || onWithdraw != null)) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  _MiniButton(
                    label: copy.addProgress,
                    filled: true,
                    onTap: onAddProgress,
                  ),
                  const SizedBox(width: 8),
                  _MiniButton(label: copy.withdraw, onTap: onWithdraw),
                  const Spacer(),
                  if (onOverflow != null)
                    InkWell(
                      onTap: onOverflow,
                      borderRadius: BorderRadius.circular(13),
                      child: Container(
                        width: 44,
                        height: 44,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          border: Border.all(color: c.line),
                          borderRadius: BorderRadius.circular(13),
                        ),
                        child: Icon(
                          Icons.more_horiz,
                          size: 20,
                          color: c.inkMuted,
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  static int _daysOverdue(String target, String today) {
    final t = DateTime.tryParse(target);
    final n = DateTime.tryParse(today);
    if (t == null || n == null) return 0;
    return n.difference(t).inDays;
  }
}

class _MiniButton extends StatelessWidget {
  const _MiniButton({required this.label, this.filled = false, this.onTap});

  final String label;
  final bool filled;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(13),
      child: Container(
        constraints: const BoxConstraints(minHeight: 44),
        padding: const EdgeInsets.symmetric(horizontal: 16),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: filled ? c.accentSoft : c.fieldFill,
          border: Border.all(color: filled ? c.accentSoft : c.line),
          borderRadius: BorderRadius.circular(13),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: filled ? c.accent : c.inkMuted,
            fontSize: 13,
            fontWeight: filled ? FontWeight.w700 : FontWeight.w600,
          ),
        ),
      ),
    );
  }
}
