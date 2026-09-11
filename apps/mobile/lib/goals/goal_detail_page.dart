import 'package:flutter/material.dart';

import '../core/decimals.dart';
import '../core/money_format.dart';
import '../i18n/app_language.dart';
import '../i18n/goals_copy.dart';
import '../theme/tokens.dart';
import '../widgets/callout.dart';
import '../widgets/primary_button.dart';
import 'goal_action_handler.dart';
import 'goal_entry_sheet.dart';
import 'goal_history.dart';
import 'goal_models.dart';
import 'goals_controller.dart';
import 'widgets/goal_money.dart';
import 'widgets/goal_progress_bar.dart';
import 'widgets/goal_sheet.dart';
import 'widgets/goal_status_pill.dart';

/// Flow 5 screen 21 — one goal: funded/target hero, primary actions, and the
/// immutable rail-and-dot history timeline (Correct / Reverse live on the ⋯
/// actions sheet, matching the canvas).
class GoalDetailPage extends StatelessWidget {
  const GoalDetailPage({
    super.key,
    required this.controller,
    required this.goalId,
  });

  final GoalsController controller;
  final String goalId;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final copy = GoalsCopy.of(AppLanguageScope.of(context).language);
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final summary = controller.goalById(goalId);
        if (summary == null) {
          return Scaffold(
            backgroundColor: c.canvas,
            appBar: AppBar(),
            body: Center(child: Text(copy.unavailableGoal)),
          );
        }
        final goal = summary.goal;
        final history = controller.historyFor(goalId);
        final byId = {for (final h in history) h.id: h};

        return Scaffold(
          backgroundColor: c.canvas,
          appBar: AppBar(
            title: Text(
              goal.name,
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(color: c.ink),
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.more_horiz),
                onPressed: () => openGoalActions(context, controller, summary),
              ),
            ],
          ),
          body: RefreshIndicator(
            onRefresh: controller.load,
            color: c.accent,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
              children: [
                _HeroCard(controller: controller, summary: summary),
                if (controller.actionError != null) ...[
                  const SizedBox(height: 14),
                  Callout(
                    tone: CalloutTone.danger,
                    message: controller.actionError!,
                  ),
                ],
                const SizedBox(height: 14),
                _HistoryCard(summary: summary, entries: history, byId: byId),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _HeroCard extends StatelessWidget {
  const _HeroCard({required this.controller, required this.summary});

  final GoalsController controller;
  final GoalSummary summary;

  void _openEntry(BuildContext context, GoalEntryMode mode) {
    controller.clearActionError();
    showGoalSheet<bool>(
      context,
      builder: (_) => GoalEntrySheet(
        controller: controller,
        goal: summary.goal,
        mode: mode,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final copy = GoalsCopy.of(AppLanguageScope.of(context).language);
    final goal = summary.goal;
    final overdue = summary.isOverdue(controller.today);
    final overTarget = D.isPositive(summary.surplusAmount);
    // Keep the true percentage for copy and use only the capped display value
    // for the visual bar.
    final fill = (double.tryParse(summary.displayPercent) ?? 0) / 100;
    final remaining = D.subtract(goal.targetAmount, summary.fundedAmount);

    final metaParts = <String>[
      copy.type(goal.goalType, custom: goal.customTypeName),
    ];
    if (goal.targetDate != null) {
      metaParts.add(copy.targetDate(goal.targetDate!));
    }
    metaParts.add(goal.currencyCode);

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: c.surface,
        border: Border.all(color: c.line),
        borderRadius: BorderRadius.circular(AppRadius.card),
        boxShadow: c.isDark
            ? null
            : [
                BoxShadow(
                  color: c.ink.withValues(alpha: 0.045),
                  blurRadius: 14,
                  offset: const Offset(0, 4),
                ),
              ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      goal.name,
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(color: c.ink, fontSize: 23),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      metaParts.join(' · '),
                      style: TextStyle(color: c.inkMuted, fontSize: 12),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              GoalStatusPill(status: goal.status, overdue: overdue),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: c.fieldFill,
              border: Border.all(color: c.line.withValues(alpha: 0.7)),
              borderRadius: BorderRadius.circular(AppRadius.card),
            ),
            child: Column(
              children: [
                _FundingAmounts(
                  fundedAmount: summary.fundedAmount,
                  targetAmount: goal.targetAmount,
                  currencyCode: goal.currencyCode,
                ),
                const SizedBox(height: 10),
                GoalProgressBar(fill: fill),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Text(
                      copy.funded(MoneyFormat.percent(summary.progressPercent)),
                      style: TextStyle(
                        color: overTarget ? c.accent : c.inkMuted,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      overTarget
                          ? copy.surplus(
                              goalMoney(
                                summary.surplusAmount,
                                goal.currencyCode,
                              ),
                            )
                          : (remaining != null && D.isPositive(remaining))
                          ? copy.remaining(
                              goalMoney(remaining, goal.currencyCode),
                            )
                          : '',
                      style: TextStyle(
                        color: c.inkMuted,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          if (goal.isMutable)
            Row(
              children: [
                Expanded(
                  child: PrimaryButton(
                    label: copy.addProgress,
                    fontSize: 14,
                    onPressed: controller.busy
                        ? null
                        : () => _openEntry(context, GoalEntryMode.progress),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: SecondaryButton(
                    label: copy.withdraw,
                    fontSize: 14,
                    onPressed: controller.busy
                        ? null
                        : () => _openEntry(context, GoalEntryMode.withdrawal),
                  ),
                ),
                const SizedBox(width: 8),
                _SquareIconButton(
                  icon: Icons.more_horiz,
                  onTap: () => openGoalActions(context, controller, summary),
                ),
              ],
            )
          else
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: c.fieldFill,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Text(
                copy.inactiveGoal(goal.status, archived: goal.isArchived),
                style: TextStyle(color: c.inkMuted, fontSize: 12, height: 1.5),
              ),
            ),
        ],
      ),
    );
  }
}

/// A 52×52 bordered icon button that lines up with the 52px button row.
class _SquareIconButton extends StatelessWidget {
  const _SquareIconButton({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.button),
      child: Container(
        width: AppSizes.button,
        height: AppSizes.button,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          border: Border.all(color: c.line),
          borderRadius: BorderRadius.circular(AppRadius.button),
        ),
        child: Icon(icon, size: 20, color: c.inkMuted),
      ),
    );
  }
}

/// Keeps full LTR money strings visible by using two columns only where the
/// available card width can support them.
class _FundingAmounts extends StatelessWidget {
  const _FundingAmounts({
    required this.fundedAmount,
    required this.targetAmount,
    required this.currencyCode,
  });

  final String fundedAmount;
  final String targetAmount;
  final String currencyCode;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final copy = GoalsCopy.of(AppLanguageScope.of(context).language);
    final funded = _AmountColumn(
      label: copy.fundedLabel,
      amount: fundedAmount,
      currencyCode: currencyCode,
      color: c.ink,
      fontSize: 24,
      alignment: Alignment.centerLeft,
    );
    final target = _AmountColumn(
      label: copy.targetLabel,
      amount: targetAmount,
      currencyCode: currencyCode,
      color: c.inkMuted,
      fontSize: 16,
      alignment: Alignment.centerRight,
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < 380) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [funded, const SizedBox(height: 12), target],
          );
        }
        return Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(child: funded),
            const SizedBox(width: 16),
            Expanded(child: target),
          ],
        );
      },
    );
  }
}

class _AmountColumn extends StatelessWidget {
  const _AmountColumn({
    required this.label,
    required this.amount,
    required this.currencyCode,
    required this.color,
    required this.fontSize,
    required this.alignment,
  });

  final String label;
  final String amount;
  final String currencyCode;
  final Color color;
  final double fontSize;
  final Alignment alignment;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final textAlign = alignment == Alignment.centerRight
        ? CrossAxisAlignment.end
        : CrossAxisAlignment.start;
    return Column(
      crossAxisAlignment: textAlign,
      children: [
        Text(
          label,
          style: TextStyle(
            color: c.inkMuted,
            fontSize: 10,
            letterSpacing: 1.2,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 2),
        SizedBox(
          width: double.infinity,
          child: FittedBox(
            alignment: alignment,
            fit: BoxFit.scaleDown,
            child: GoalMoney(
              amount: amount,
              currencyCode: currencyCode,
              style: TextStyle(
                color: color,
                fontSize: fontSize,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

String? _fmtTime(String createdIso) {
  final d = DateTime.tryParse(createdIso)?.toLocal();
  if (d == null) return null;
  return '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
}

/// The immutable history timeline (canvas screen 21): a coloured-dot rail, a
/// title + amount line, a `date · time · note` line, and a closing "Goal
/// created" row. Actions live on the ⋯ sheet, not per row.
class _HistoryCard extends StatelessWidget {
  const _HistoryCard({
    required this.summary,
    required this.entries,
    required this.byId,
  });

  final GoalSummary summary;
  final List<GoalHistoryEntry> entries;
  final Map<String, GoalHistoryEntry> byId;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final copy = GoalsCopy.of(AppLanguageScope.of(context).language);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: c.surface,
        border: Border.all(color: c.line),
        borderRadius: BorderRadius.circular(AppRadius.card),
        boxShadow: c.isDark
            ? null
            : [
                BoxShadow(
                  color: c.ink.withValues(alpha: 0.045),
                  blurRadius: 14,
                  offset: const Offset(0, 4),
                ),
              ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                copy.history,
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(color: c.ink, fontSize: 19),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: c.fieldFill,
                  border: Border.all(color: c.line),
                  borderRadius: BorderRadius.circular(AppRadius.chip),
                ),
                child: Text(
                  copy.immutable,
                  style: TextStyle(
                    color: c.inkMuted,
                    fontSize: 9,
                    letterSpacing: 1,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          for (final entry in entries)
            _TimelineRow(
              summary: summary,
              entry: entry,
              byId: byId,
              isLast: false,
            ),
          _TimelineRow(summary: summary, entry: null, byId: byId, isLast: true),
        ],
      ),
    );
  }
}

class _TimelineRow extends StatelessWidget {
  const _TimelineRow({
    required this.summary,
    required this.entry,
    required this.byId,
    required this.isLast,
  });

  /// null renders the synthetic "Goal created" row.
  final GoalHistoryEntry? entry;
  final GoalSummary summary;
  final Map<String, GoalHistoryEntry> byId;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final copy = GoalsCopy.of(AppLanguageScope.of(context).language);
    final goal = summary.goal;

    if (entry == null) {
      return _row(
        context,
        dotColor: c.disabledFill,
        railTail: false,
        faded: false,
        title: copy.goalCreated,
        amount: null,
        amountColor: c.inkMuted,
        subtitle: copy.createdTarget(
          copy.formatDate(goal.createdAt),
          MoneyFormat.money(goal.targetAmount, goal.currencyCode),
        ),
        relationship: null,
      );
    }

    final h = entry!;
    final e = h.entry;
    final isReversal = e.entryType == 'reversal';
    final isReplacement = e.replacementForEntryId != null;
    final reversed = h.reversedByEntryId != null;
    final faded = isReversal || reversed;
    final sign = historySign(h, byId);

    final Color dot;
    if (isReversal || isReplacement) {
      dot = c.metal;
    } else if (e.entryType == 'withdrawal') {
      dot = c.negative;
    } else {
      dot = c.accent;
    }

    // A replacement shows "old → new"; everything else shows a signed amount.
    String amountText;
    Color amountColor;
    if (isReplacement) {
      final original = byId[e.replacementForEntryId];
      final from = original == null
          ? null
          : MoneyFormat.money(original.entry.amount, goal.currencyCode);
      amountText = from == null
          ? MoneyFormat.money(e.amount, goal.currencyCode)
          : '$from → ${MoneyFormat.money(e.amount, goal.currencyCode)}';
      amountColor = c.inkMuted;
    } else {
      amountText = goalMoney(e.amount, goal.currencyCode, sign: sign);
      amountColor = sign == '+'
          ? c.accent
          : (isReversal ? c.metal : c.negative);
    }

    final time = _fmtTime(e.createdAt);
    final subtitle = [
      copy.ltr(copy.formatDate(e.effectiveOn)),
      if (time != null) copy.ltr(time),
      if (e.note != null && e.note!.isNotEmpty) '“${e.note}”',
    ].join(' · ');

    return _row(
      context,
      dotColor: dot,
      railTail: true,
      faded: faded,
      title: _title(copy),
      amount: amountText,
      amountColor: amountColor,
      subtitle: subtitle,
      relationship: _relationship(copy),
    );
  }

  Widget _row(
    BuildContext context, {
    required Color dotColor,
    required bool railTail,
    required bool faded,
    required String title,
    required String? amount,
    required Color amountColor,
    required String subtitle,
    required String? relationship,
  }) {
    final c = context.colors;
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 18,
            child: Stack(
              children: [
                Positioned(
                  left: 8,
                  top: 3,
                  bottom: 0,
                  child: Container(
                    width: 2,
                    color: railTail && !isLast ? c.line : Colors.transparent,
                  ),
                ),
                Positioned(
                  left: 4,
                  top: 3,
                  child: Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: dotColor,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: Opacity(
              opacity: faded ? 0.72 : 1,
              child: Padding(
                padding: EdgeInsets.only(bottom: isLast ? 0 : 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            title,
                            style: TextStyle(
                              color: c.ink,
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        if (amount != null) ...[
                          const SizedBox(width: 8),
                          Text(
                            amount,
                            textDirection: TextDirection.ltr,
                            style: TextStyle(
                              color: amountColor,
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              fontFeatures: const [
                                FontFeature.tabularFigures(),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      subtitle,
                      style: TextStyle(color: c.inkMuted, fontSize: 12),
                    ),
                    if (relationship != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        relationship,
                        style: TextStyle(color: c.inkMuted, fontSize: 11),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _title(GoalsCopy copy) {
    final h = entry!;
    final e = h.entry;
    final kind = historyEntryKind(h, byId);
    if (e.entryType == 'reversal') {
      final original = byId[e.reversesEntryId];
      return original?.replacementEntryId != null
          ? copy.historyTitle('correction')
          : copy.historyTitle('reversal');
    }
    if (e.replacementForEntryId != null) {
      return kind == 'withdrawal'
          ? copy.historyTitle('correctedWithdrawal')
          : copy.historyTitle('correctedProgress');
    }
    return copy.historyTitle(kind == 'withdrawal' ? 'withdrawal' : 'progress');
  }

  String? _relationship(GoalsCopy copy) {
    final h = entry!;
    final e = h.entry;
    if (e.reversesEntryId != null) {
      final original = byId[e.reversesEntryId];
      if (original == null) return null;
      final t = original.entry.entryType == 'withdrawal'
          ? copy.withdrawalNoun
          : copy.progressNoun;
      return copy.reverses(t, copy.formatDate(original.entry.effectiveOn));
    }
    if (e.replacementForEntryId != null) {
      final original = byId[e.replacementForEntryId];
      if (original == null) return null;
      return copy.correctsEarlier;
    }
    if (h.reversedByEntryId != null) {
      final replacement = h.replacementEntryId != null
          ? byId[h.replacementEntryId]
          : null;
      return replacement != null
          ? copy.correctedTo(
              goalMoney(replacement.entry.amount, summary.goal.currencyCode),
              copy.formatDate(replacement.entry.effectiveOn),
            )
          : copy.reversedNotCounted;
    }
    return null;
  }
}
