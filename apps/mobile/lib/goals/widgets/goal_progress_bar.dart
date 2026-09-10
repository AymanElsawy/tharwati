import 'package:flutter/material.dart';

import '../../theme/tokens.dart';

/// The capped goal progress bar (Flow 5 cards + detail). [fill] comes from the
/// summary's capped display percent. The real percent remains available to the
/// caller for the "124% funded" copy and over-target amount.
class GoalProgressBar extends StatelessWidget {
  const GoalProgressBar({
    super.key,
    required this.fill,
    this.height = 8,
    this.muted = false,
  });

  final double fill;
  final double height;

  /// Archived/inactive goals draw the fill in a grey instead of the accent.
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final fillColor = muted ? c.disabledFill : c.accent;
    final visualFill = fill.clamp(0.0, 1.0).toDouble();
    return SizedBox(
      width: double.infinity,
      height: height,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadius.chip),
        child: LayoutBuilder(
          builder: (context, constraints) => Stack(
            fit: StackFit.expand,
            children: [
              ColoredBox(color: c.fieldFill),
              Align(
                alignment: Alignment.centerLeft,
                child: SizedBox(
                  width: constraints.maxWidth * visualFill,
                  height: constraints.maxHeight,
                  child: ColoredBox(color: fillColor),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
