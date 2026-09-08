import 'package:flutter/material.dart';

import '../../theme/tokens.dart';

/// The capped goal progress bar (Flow 5 cards + detail). [fill] is 0..1 (the
/// display percent / 100); when the real percent is over 100 the fill is a
/// diagonal hatch, matching the canvas "124% funded" treatment.
class GoalProgressBar extends StatelessWidget {
  const GoalProgressBar({
    super.key,
    required this.fill,
    this.hatched = false,
    this.height = 8,
    this.muted = false,
  });

  final double fill;
  final bool hatched;
  final double height;

  /// Archived/inactive goals draw the fill in a grey instead of the accent.
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final fillColor = muted ? c.disabledFill : c.accent;
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.chip),
      child: SizedBox(
        height: height,
        child: Stack(
          children: [
            Container(color: c.canvas),
            FractionallySizedBox(
              widthFactor: fill.clamp(0.0, 1.0),
              child: hatched
                  ? CustomPaint(painter: _HatchPainter(fillColor))
                  : Container(color: fillColor),
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
