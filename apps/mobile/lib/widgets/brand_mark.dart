import 'package:flutter/material.dart';

import '../theme/tokens.dart';
import 'tharwati_brand.dart';

/// Auth-facing arrangement of the shared source-derived Tharwati mark,
/// wordmark, and tagline.
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.showTagline = true});

  final bool showTagline;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const TharwatiBrand(width: 72),
        const SizedBox(height: 18),
        Text(
          'Tharwati',
          style: Theme.of(context).textTheme.displaySmall?.copyWith(
            color: c.ink,
            fontSize: 34,
            height: 1.05,
            letterSpacing: -0.6,
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
