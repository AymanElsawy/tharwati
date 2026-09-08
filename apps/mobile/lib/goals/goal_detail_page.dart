import 'package:flutter/material.dart';

import '../core/decimals.dart';
import '../core/money_format.dart';
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
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final summary = controller.goalById(goalId);
        if (summary == null) {
          return Scaffold(
            backgroundColor: c.canvas,
            appBar: AppBar(),
            body: const Center(
              child: Text('This goal is no longer available.'),
            ),
          );
        }
        final goal = summary.goal;
        final history = controller.historyFor(goalId);
        final byId = {for (final h in history) h.id: h};

        return Scaffold(
          backgroundColor: c.canvas,
          appBar: AppBar(
            title: Text(goal.name),
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
    final goal = summary.goal;
    final overdue = summary.isOverdue(controller.today);
    final overTarget = D.isPositive(summary.surplusAmount);
    final capped = (D.compare(summary.progressPercent, '100') ?? 0) > 0;
    final fill = (double.tryParse(summary.displayPercent) ?? 0) / 100;
    final remaining = D.subtract(goal.targetAmount, summary.fundedAmount);

    final metaParts = <String>[goal.typeLabel];
    if (goal.targetDate != null) metaParts.add('target ${goal.targetDate}');
    metaParts.add(goal.currencyCode);

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: c.surface,
        border: Border.all(color: c.line),
        borderRadius: BorderRadius.circular(AppRadius.card),
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
                      style: TextStyle(
                        color: c.ink,
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                      ),
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
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _label(c, 'FUNDED'),
                        const SizedBox(height: 2),
                        GoalMoney(
                          amount: summary.fundedAmount,
                          currencyCode: goal.currencyCode,
                          style: TextStyle(
                            color: c.ink,
                            fontSize: 24,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                    const Spacer(),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        _label(c, 'TARGET'),
                        const SizedBox(height: 2),
                        GoalMoney(
                          amount: goal.targetAmount,
                          currencyCode: goal.currencyCode,
                          style: TextStyle(
                            color: c.inkMuted,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                GoalProgressBar(fill: fill, hatched: capped),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Text(
                      '${MoneyFormat.percent(summary.progressPercent)} funded',
                      style: TextStyle(
                        color: overTarget ? c.accent : c.inkMuted,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      overTarget
                          ? '${goalMoney(summary.surplusAmount, goal.currencyCode)} over target'
                          : (remaining != null && D.isPositive(remaining))
                          ? '${goalMoney(remaining, goal.currencyCode)} remaining'
                          : '',
                      textDirection: TextDirection.ltr,
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
                    label: 'Add progress',
                    fontSize: 14,
                    onPressed: controller.busy
                        ? null
                        : () => _openEntry(context, GoalEntryMode.progress),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: SecondaryButton(
                    label: 'Withdraw',
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
                goal.isArchived
                    ? 'This goal is archived. Unarchive it from the ⋯ menu to '
                          'add progress again.'
                    : 'This goal is ${goal.status}. Reopen it from the ⋯ menu to '
                          'add progress again.',
                style: TextStyle(color: c.inkMuted, fontSize: 12, height: 1.5),
              ),
            ),
        ],
      ),
    );
  }

  Widget _label(AppColors c, String text) => Text(
    text,
    style: TextStyle(
      color: c.inkMuted,
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: FontWeight.w700,
    ),
  );
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

const _months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

String _fmtDate(String iso) {
  final parts = iso.split('T').first.split('-');
  if (parts.length != 3) return iso;
  final month = int.tryParse(parts[1]) ?? 1;
  final day = int.tryParse(parts[2]) ?? 0;
  return '$day ${_months[(month - 1).clamp(0, 11)]} ${parts[0]}';
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
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: c.surface,
        border: Border.all(color: c.line),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'History',
                style: TextStyle(
                  color: c.ink,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
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
                  'IMMUTABLE',
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
    final goal = summary.goal;

    if (entry == null) {
      return _row(
        context,
        dotColor: c.disabledFill,
        railTail: false,
        faded: false,
        title: 'Goal created',
        amount: null,
        amountColor: c.inkMuted,
        subtitle:
            '${_fmtDate(goal.createdAt)} · target ${MoneyFormat.money(goal.targetAmount, goal.currencyCode)}',
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
      _fmtDate(e.effectiveOn),
      ?time,
      if (e.note != null && e.note!.isNotEmpty) '“${e.note}”',
    ].join(' · ');

    return _row(
      context,
      dotColor: dot,
      railTail: true,
      faded: faded,
      title: _title(),
      amount: amountText,
      amountColor: amountColor,
      subtitle: subtitle,
      relationship: _relationship(),
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
                      textDirection: TextDirection.ltr,
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

  String _title() {
    final h = entry!;
    final e = h.entry;
    final kind = historyEntryKind(h, byId);
    if (e.entryType == 'reversal') {
      final original = byId[e.reversesEntryId];
      return original?.replacementEntryId != null
          ? 'Correction recorded'
          : 'Reversal recorded';
    }
    if (e.replacementForEntryId != null) {
      return kind == 'withdrawal'
          ? 'Corrected withdrawal'
          : 'Corrected progress';
    }
    return kind == 'withdrawal' ? 'Withdrawn' : 'Progress added';
  }

  String? _relationship() {
    final h = entry!;
    final e = h.entry;
    if (e.reversesEntryId != null) {
      final original = byId[e.reversesEntryId];
      if (original == null) return null;
      final t = original.entry.entryType == 'withdrawal'
          ? 'withdrawal'
          : 'progress';
      return 'Reverses the $t from ${_fmtDate(original.entry.effectiveOn)}';
    }
    if (e.replacementForEntryId != null) {
      final original = byId[e.replacementForEntryId];
      if (original == null) return null;
      return 'Corrects an earlier entry — both values stay in the history';
    }
    if (h.reversedByEntryId != null) {
      final replacement = h.replacementEntryId != null
          ? byId[h.replacementEntryId]
          : null;
      return replacement != null
          ? 'Corrected to ${goalMoney(replacement.entry.amount, summary.goal.currencyCode)} on ${_fmtDate(replacement.entry.effectiveOn)}'
          : 'Reversed — no longer counted';
    }
    return null;
  }
}
