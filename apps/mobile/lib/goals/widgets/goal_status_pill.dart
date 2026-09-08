import 'package:flutter/material.dart';

import '../../theme/tokens.dart';

/// The small uppercase status chip on the Flow 5 cards / detail header.
/// `OVERDUE` (an active goal past its target date) reads as its own state.
class GoalStatusPill extends StatelessWidget {
  const GoalStatusPill({super.key, required this.status, this.overdue = false});

  final String status; // 'active' | 'completed' | 'cancelled'
  final bool overdue;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    late final Color bg;
    late final Color fg;
    late final String label;

    if (overdue) {
      bg = c.negativeSoft;
      fg = c.negative;
      label = 'OVERDUE';
    } else {
      switch (status) {
        case 'completed':
          bg = c.isDark ? const Color(0xFF1B2A3A) : const Color(0xFFEAF0F6);
          fg = c.isDark ? const Color(0xFF9BBBDD) : const Color(0xFF3D5A80);
          label = 'COMPLETED';
        case 'cancelled':
          bg = c.warningSoft;
          fg = c.warningFg;
          label = 'CANCELLED';
        default:
          bg = c.accentSoft;
          fg = c.accent;
          label = 'ACTIVE';
      }
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadius.chip),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: fg,
          fontSize: 10,
          letterSpacing: 0.6,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
