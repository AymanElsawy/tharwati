import 'package:flutter/material.dart';

import '../theme/tokens.dart';

/// The `ث` accent tile plus the "Tharwati" wordmark and tagline, as on the
/// Sign in artboard (Flow 1 · 01).
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.showTagline = true});

  final bool showTagline;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 52,
          height: 52,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: c.accent,
            borderRadius: BorderRadius.circular(16),
          ),
          child: const Text(
            'ث',
            style: TextStyle(
              color: Colors.white,
              fontSize: 24,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        const SizedBox(height: 18),
        Text(
          'Tharwati',
          style: TextStyle(
            color: c.accent,
            fontSize: 34,
            height: 1.05,
            letterSpacing: -1,
            fontWeight: FontWeight.w800,
          ),
        ),
        if (showTagline) ...[
          const SizedBox(height: 4),
          Text(
            'Build. Grow. Preserve.',
            style: TextStyle(
              color: c.inkMuted,
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ],
    );
  }
}
