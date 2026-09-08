import 'package:flutter/material.dart';

import '../theme/tokens.dart';

/// Onboarding progress bar — filled segments plus an `n / total` counter, as on
/// artboards 05 and 06.
class StepDots extends StatelessWidget {
  const StepDots({super.key, required this.step, required this.total});

  /// 1-based index of the current step.
  final int step;
  final int total;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Row(
      children: [
        for (var i = 1; i <= total; i++)
          Expanded(
            child: Container(
              margin: EdgeInsets.only(right: i == total ? 0 : 6),
              height: 4,
              decoration: BoxDecoration(
                color: i <= step ? c.accent : c.line,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
        const SizedBox(width: 12),
        Text(
          '$step / $total',
          style: TextStyle(
            color: c.inkMuted,
            fontSize: 12,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}
