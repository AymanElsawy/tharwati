import 'package:flutter/material.dart';

import '../../core/decimals.dart';
import '../../core/money_format.dart';
import '../../i18n/app_language.dart';
import '../../i18n/dashboard_copy.dart';
import '../../goals/goal_models.dart';
import '../../theme/tokens.dart';
import '../state/dashboard_goals_controller.dart';
import 'dashboard_card.dart';

class GoalsCard extends StatelessWidget {
  const GoalsCard({super.key, required this.controller, this.onViewAll});

  final DashboardGoalsController controller;
  final VoidCallback? onViewAll;

  static String _today() => DateTime.now().toIso8601String().substring(0, 10);

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final copy = DashboardCopy.of(AppLanguageScope.of(context).language);
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final status = controller.status;
        final model = controller.model;
        final activeCount = model?.goals.length ?? 0;

        return DashboardCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    copy.goals,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: c.ink,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (status == GoalsCardStatus.ready && activeCount > 0)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 9,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: c.fieldFill,
                            border: Border.all(color: c.line),
                            borderRadius: BorderRadius.circular(AppRadius.chip),
                          ),
                          child: Text(
                            copy.activeGoals(activeCount),
                            style: TextStyle(
                              color: c.inkMuted,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      if (onViewAll != null) ...[
                        const SizedBox(width: 6),
                        InkWell(
                          onTap: onViewAll,
                          borderRadius: BorderRadius.circular(AppRadius.chip),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 4,
                              vertical: 2,
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  copy.viewAll,
                                  style: TextStyle(
                                    color: c.accent,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                Icon(
                                  Icons.chevron_right,
                                  size: 16,
                                  color: c.accent,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                copy.goalsHint,
                style: TextStyle(color: c.inkMuted, fontSize: 12),
              ),
              const SizedBox(height: 14),
              switch (status) {
                GoalsCardStatus.loading => const _GoalSkeletons(),
                GoalsCardStatus.error => _GoalsMessage(
                  text: copy.goalsLoadError,
                  actionLabel: copy.retry,
                  onAction: controller.load,
                ),
                GoalsCardStatus.ready when model!.goals.isEmpty =>
                  _GoalsMessage(
                    text: model.hasAnyGoals ? copy.noActiveGoals : copy.noGoals,
                    actionLabel: model.hasAnyGoals
                        ? copy.viewAllGoals
                        : copy.createGoal,
                    onAction: onViewAll,
                  ),
                GoalsCardStatus.ready => Column(
                  children: [
                    for (final goal in model!.goals) ...[
                      _GoalRow(
                        summary: goal,
                        today: _today(),
                        onTap: onViewAll,
                      ),
                      if (goal != model.goals.last)
                        Divider(height: 20, color: c.line),
                    ],
                  ],
                ),
              },
            ],
          ),
        );
      },
    );
  }
}

class _GoalRow extends StatelessWidget {
  const _GoalRow({required this.summary, required this.today, this.onTap});

  final GoalSummary summary;
  final String today;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final copy = DashboardCopy.of(AppLanguageScope.of(context).language);
    final goal = summary.goal;
    final overdue = summary.isOverdue(today);
    final overTarget = D.isPositive(summary.surplusAmount);
    final capped = (D.compare(summary.progressPercent, '100') ?? 0) > 0;
    final fill = (double.tryParse(summary.displayPercent) ?? 0) / 100;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    goal.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: c.ink,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  '${MoneyFormat.money(summary.fundedAmount, goal.currencyCode)}'
                  ' / ${MoneyFormat.money(goal.targetAmount, goal.currencyCode)}',
                  textDirection: TextDirection.ltr,
                  style: TextStyle(color: c.inkMuted, fontSize: 12),
                ),
              ],
            ),
            if (goal.targetDate != null) ...[
              const SizedBox(height: 3),
              Row(
                children: [
                  Icon(
                    Icons.event_outlined,
                    size: 13,
                    color: overdue ? c.negative : c.inkMuted,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    overdue
                        ? copy.overdue(goal.targetDate!)
                        : copy.due(goal.targetDate!),
                    style: TextStyle(
                      color: overdue ? c.negative : c.inkMuted,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 7),
            Row(
              children: [
                SizedBox(
                  width: 46,
                  child: Text(
                    MoneyFormat.percent(summary.progressPercent),
                    textDirection: TextDirection.ltr,
                    style: TextStyle(
                      color: capped ? c.accent : c.ink,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _GoalBar(fill: fill, hatched: capped),
                ),
              ],
            ),
            if (overTarget) ...[
              const SizedBox(height: 4),
              Text(
                copy.overTarget(
                  MoneyFormat.money(summary.surplusAmount, goal.currencyCode),
                ),
                style: TextStyle(
                  color: c.accent,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _GoalBar extends StatelessWidget {
  const _GoalBar({required this.fill, required this.hatched});

  final double fill;
  final bool hatched;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.chip),
      child: SizedBox(
        height: 7,
        child: Stack(
          children: [
            Container(color: c.canvas),
            FractionallySizedBox(
              widthFactor: fill.clamp(0.0, 1.0),
              child: hatched
                  ? CustomPaint(painter: _HatchPainter(c.accent))
                  : Container(color: c.accent),
            ),
          ],
        ),
      ),
    );
  }
}

class _HatchPainter extends CustomPainter {
  _HatchPainter(this.base);

  final Color base;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Offset.zero & size, Paint()..color = base);
    final stripe = Paint()..color = Colors.white.withValues(alpha: 0.55);
    for (double x = -size.height; x < size.width; x += 9) {
      final path = Path()
        ..moveTo(x, size.height)
        ..lineTo(x + size.height, 0)
        ..lineTo(x + size.height + 4, 0)
        ..lineTo(x + 4, size.height)
        ..close();
      canvas.drawPath(path, stripe);
    }
  }

  @override
  bool shouldRepaint(_HatchPainter old) => old.base != base;
}

class _GoalsMessage extends StatelessWidget {
  const _GoalsMessage({
    required this.text,
    required this.actionLabel,
    required this.onAction,
  });

  final String text;
  final String actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: c.fieldFill,
        borderRadius: BorderRadius.circular(AppRadius.field),
      ),
      child: Column(
        children: [
          Text(
            text,
            textAlign: TextAlign.center,
            style: TextStyle(color: c.inkMuted, fontSize: 13, height: 1.5),
          ),
          const SizedBox(height: 10),
          TextButton(onPressed: onAction, child: Text(actionLabel)),
        ],
      ),
    );
  }
}

class _GoalSkeletons extends StatelessWidget {
  const _GoalSkeletons();

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    Widget bar(double w, double h) => Container(
      width: w,
      height: h,
      decoration: BoxDecoration(
        color: c.line,
        borderRadius: BorderRadius.circular(6),
      ),
    );
    return Column(
      children: [
        for (var i = 0; i < 3; i++) ...[
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [bar(120, 12), bar(90, 10)],
          ),
          const SizedBox(height: 8),
          bar(double.infinity, 7),
          if (i != 2) const SizedBox(height: 16),
        ],
      ],
    );
  }
}
