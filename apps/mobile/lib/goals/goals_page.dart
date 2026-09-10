import 'package:flutter/material.dart';

import '../dashboard/data/dashboard_repository.dart';
import '../theme/tokens.dart';
import '../widgets/callout.dart';
import 'goal_action_handler.dart';
import 'goal_detail_page.dart';
import 'goal_entry_sheet.dart';
import 'goals_controller.dart';
import 'widgets/goal_list_card.dart';
import 'widgets/goal_sheet.dart';

/// Flow 5 screens 19 / 20 — the Goals tab: Current / Archived lists of manual
/// savings trackers. All create / progress / lifecycle actions run through
/// [GoalsController] and ping the dashboard on success.
class GoalsPage extends StatefulWidget {
  const GoalsPage({super.key});

  @override
  State<GoalsPage> createState() => _GoalsPageState();
}

class _GoalsPageState extends State<GoalsPage> {
  final _controller = GoalsController();
  String _defaultCurrency = 'EGP';

  @override
  void initState() {
    super.initState();
    _loadDefaultCurrency();
  }

  Future<void> _loadDefaultCurrency() async {
    try {
      final code = await DashboardRepository().fetchBaseCurrency();
      if (code != null && mounted) setState(() => _defaultCurrency = code);
    } catch (_) {
      // Falls back to EGP — the form's currency is editable anyway.
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _openDetail(String goalId) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => GoalDetailPage(controller: _controller, goalId: goalId),
      ),
    );
  }

  Future<void> _quickEntry(String goalId, GoalEntryMode mode) async {
    final summary = _controller.goalById(goalId);
    if (summary == null) return;
    _controller.clearActionError();
    await showGoalSheet<bool>(
      context,
      builder: (_) => GoalEntrySheet(
        controller: _controller,
        goal: summary.goal,
        mode: mode,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: c.canvas,
      body: SafeArea(
        child: ListenableBuilder(
          listenable: _controller,
          builder: (context, _) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _Header(
                  controller: _controller,
                  onAdd: () => openGoalForm(
                    context,
                    _controller,
                    defaultCurrency: _defaultCurrency,
                  ),
                ),
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: _controller.load,
                    color: c.accent,
                    child: _body(context),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _body(BuildContext context) {
    final c = context.colors;
    switch (_controller.status) {
      case GoalsStatus.loading:
        return ListView(
          padding: const EdgeInsets.fromLTRB(18, 16, 18, 32),
          children: const [
            _GoalsLoadingCard(height: 176),
            SizedBox(height: 12),
            _GoalsLoadingCard(height: 176),
            SizedBox(height: 12),
            _GoalsLoadingCard(height: 132),
          ],
        );
      case GoalsStatus.error:
        return ListView(
          padding: const EdgeInsets.all(18),
          children: [
            Callout(
              tone: CalloutTone.danger,
              title: 'Couldn’t load your goals',
              message: 'Your records are safe. Pull to refresh or try again.',
              action: OutlinedButton(
                onPressed: _controller.load,
                child: const Text('Retry'),
              ),
            ),
          ],
        );
      case GoalsStatus.ready:
        final goals = _controller.visible;
        return ListView(
          padding: const EdgeInsets.fromLTRB(18, 4, 18, 32),
          children: [
            if (_controller.actionError != null) ...[
              Callout(
                tone: CalloutTone.danger,
                message: _controller.actionError!,
              ),
              const SizedBox(height: 12),
            ],
            if (goals.isEmpty)
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: c.surface,
                  border: Border.all(color: c.line),
                  borderRadius: BorderRadius.circular(AppRadius.card),
                ),
                child: Text(
                  _controller.showArchived
                      ? 'No archived goals. Archived goals keep their full '
                            'history — nothing is ever deleted.'
                      : 'No current goals yet. A goal tracks savings on its own '
                            'and never changes your net worth.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: c.inkMuted,
                    fontSize: 13,
                    height: 1.5,
                  ),
                ),
              )
            else
              for (final summary in goals) ...[
                GoalListCard(
                  summary: summary,
                  today: _controller.today,
                  onTap: () => _openDetail(summary.goal.id),
                  onAddProgress: () =>
                      _quickEntry(summary.goal.id, GoalEntryMode.progress),
                  onWithdraw: () =>
                      _quickEntry(summary.goal.id, GoalEntryMode.withdrawal),
                  onOverflow: () =>
                      openGoalActions(context, _controller, summary),
                ),
                const SizedBox(height: 12),
              ],
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.all(13),
              decoration: BoxDecoration(
                color: c.fieldFill,
                border: Border.all(color: c.line),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Text(
                'Goal progress is a separate ledger. Moving money in real life? '
                'Update the account too.',
                style: TextStyle(color: c.inkMuted, fontSize: 12, height: 1.5),
              ),
            ),
          ],
        );
    }
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.controller, required this.onAdd});

  final GoalsController controller;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 12, 18, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Goals',
                      style: Theme.of(context).textTheme.headlineMedium
                          ?.copyWith(color: c.ink, fontSize: 30),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Savings tracked by hand · net worth untouched',
                      style: TextStyle(color: c.inkMuted, fontSize: 13),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              IconButton(
                onPressed: onAdd,
                tooltip: 'Add goal',
                style: IconButton.styleFrom(
                  minimumSize: const Size(44, 44),
                  backgroundColor: c.accent,
                  foregroundColor: c.onAccent,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadius.field),
                  ),
                ),
                icon: const Icon(Icons.add, size: 22),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              color: c.fieldFill,
              border: Border.all(color: c.line),
              borderRadius: BorderRadius.circular(13),
            ),
            child: Row(
              children: [
                _Segment(
                  label: 'Current · ${controller.currentCount}',
                  selected: !controller.showArchived,
                  onTap: () => controller.setShowArchived(false),
                ),
                _Segment(
                  label: 'Archived · ${controller.archivedCount}',
                  selected: controller.showArchived,
                  onTap: () => controller.setShowArchived(true),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Segment extends StatelessWidget {
  const _Segment({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: AppSizes.touchTarget),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? c.surface : Colors.transparent,
            border: selected ? Border.all(color: c.line) : null,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: selected ? c.ink : c.inkMuted,
              fontSize: 13,
              fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }
}

class _GoalsLoadingCard extends StatelessWidget {
  const _GoalsLoadingCard({required this.height});

  final double height;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      height: height,
      decoration: BoxDecoration(
        color: c.surface,
        border: Border.all(color: c.line),
        borderRadius: BorderRadius.circular(AppRadius.card),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _line(c, 132),
            const SizedBox(height: 12),
            _line(c, 92),
            const Spacer(),
            _line(c, double.infinity, height: 8),
            const SizedBox(height: 12),
            _line(c, 176),
          ],
        ),
      ),
    );
  }

  Widget _line(AppColors c, double width, {double height = 12}) => Container(
    width: width,
    height: height,
    decoration: BoxDecoration(
      color: c.fieldFill,
      borderRadius: BorderRadius.circular(AppRadius.chip),
    ),
  );
}
