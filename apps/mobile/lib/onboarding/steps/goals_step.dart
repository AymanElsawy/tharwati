import 'package:flutter/material.dart';

import '../../theme/tokens.dart';
import '../onboarding_scaffold.dart';

/// Goal ids match the web app (`GoalsPage`) so `profiles.selected_goals` reads
/// the same on both platforms.
class GoalOption {
  const GoalOption(this.id, this.label, this.icon);

  final String id;
  final String label;
  final IconData icon;
}

const kGoalOptions = <GoalOption>[
  GoalOption('buy_home', 'Buy a home', Icons.home_outlined),
  GoalOption('buy_car', 'Buy a car', Icons.directions_car_outlined),
  GoalOption('travel', 'Travel', Icons.flight_outlined),
  GoalOption('education', 'Education', Icons.school_outlined),
  GoalOption('other', 'Other', Icons.more_horiz),
];

/// Onboarding step 4 — "What are you working toward?". Multi-select; at least
/// one is required to continue.
class GoalsStep extends StatelessWidget {
  const GoalsStep({
    super.key,
    required this.selected,
    required this.onBack,
    required this.onToggle,
    required this.onContinue,
  });

  final Set<String> selected;
  final VoidCallback onBack;
  final ValueChanged<String> onToggle;
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    return OnboardingScaffold(
      step: 4,
      title: 'What are you working toward?',
      subtitle:
          'Choose all that apply. This orders your insights and progress '
          'tracking — no goals are created.',
      primaryLabel: 'Continue',
      primaryEnabled: selected.isNotEmpty,
      onPrimary: onContinue,
      onBack: onBack,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final goal in kGoalOptions)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _GoalTile(
                goal: goal,
                selected: selected.contains(goal.id),
                onTap: () => onToggle(goal.id),
              ),
            ),
        ],
      ),
    );
  }
}

class _GoalTile extends StatelessWidget {
  const _GoalTile({
    required this.goal,
    required this.selected,
    required this.onTap,
  });

  final GoalOption goal;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        constraints: const BoxConstraints(minHeight: AppSizes.listRow),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: selected ? c.accentSoft : c.surface,
          border: Border.all(
            color: selected ? c.accent : c.line,
            width: selected ? 1.5 : 1,
          ),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: selected ? c.surface : c.fieldFill,
                borderRadius: BorderRadius.circular(11),
              ),
              child: Icon(goal.icon, size: 20, color: c.accent),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                goal.label,
                style: TextStyle(
                  color: c.ink,
                  fontSize: 15,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
                ),
              ),
            ),
            if (selected) Icon(Icons.check, size: 20, color: c.accent),
          ],
        ),
      ),
    );
  }
}
