import 'package:flutter/material.dart';

import '../../theme/tokens.dart';
import '../logic/key_insights.dart';
import 'dashboard_card.dart';

class KeyInsightsCard extends StatelessWidget {
  const KeyInsightsCard({super.key, required this.insight});

  final KeyInsight insight;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final (Color bg, Color fg, IconData icon) = switch (insight.tone) {
      InsightTone.ready => (c.accentSoft, c.accent, Icons.verified_outlined),
      InsightTone.stale => (
        c.warningSoft,
        c.warningFg,
        Icons.schedule_outlined,
      ),
      InsightTone.empty => (c.fieldFill, c.inkMuted, Icons.lightbulb_outline),
      InsightTone.incomplete => (
        c.warningSoft,
        c.warningFg,
        Icons.error_outline,
      ),
    };

    return DashboardCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Key insights',
                style: TextStyle(
                  color: c.ink,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                'Data quality',
                style: TextStyle(color: c.inkMuted, fontSize: 11),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(13),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(icon, size: 18, color: fg),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        insight.title,
                        style: TextStyle(
                          color: c.ink,
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        insight.body,
                        style: TextStyle(
                          color: c.ink.withValues(alpha: 0.8),
                          fontSize: 13,
                          height: 1.45,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
