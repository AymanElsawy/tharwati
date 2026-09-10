import 'package:flutter/material.dart';

import '../../theme/tokens.dart';

/// A compact type indicator for a goal card. It carries no goal state and is
/// deliberately separate from the card's plain semantic surface.
class GoalTypeIcon extends StatelessWidget {
  const GoalTypeIcon({super.key, required this.goalType, this.muted = false});

  final String goalType;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      width: 40,
      height: 40,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: muted ? c.disabledFill : c.accentSoft,
        border: Border.all(color: c.line),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Icon(
        _iconFor(goalType),
        size: 21,
        color: muted ? c.disabledFg : (goalType == 'other' ? c.metal : c.accent),
      ),
    );
  }

  static IconData _iconFor(String type) => switch (type) {
    'buy_home' => Icons.home_outlined,
    'buy_car' => Icons.directions_car_outlined,
    'travel' => Icons.flight_takeoff_outlined,
    'education' => Icons.school_outlined,
    _ => Icons.auto_awesome_outlined,
  };
}
