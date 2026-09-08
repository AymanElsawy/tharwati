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
          children: const [
            SizedBox(height: 120),
            Center(child: CircularProgressIndicator()),
          ],
        );
      case GoalsStatus.error:
        return ListView(
          padding: const EdgeInsets.all(20),
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
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
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
                  borderRadius: BorderRadius.circular(20),
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
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
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
                      style: TextStyle(
                        color: c.ink,
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.5,
                      ),
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
              InkWell(
                onTap: onAdd,
                borderRadius: BorderRadius.circular(14),
                child: Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: c.accent,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(Icons.add, color: Colors.white, size: 22),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              color: c.surface,
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
          height: 38,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? c.accent : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: selected ? Colors.white : c.inkMuted,
              fontSize: 13,
              fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }
}
