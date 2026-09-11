import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/decimals.dart';
import '../../core/money_format.dart';
import '../../i18n/app_language.dart';
import '../../i18n/dashboard_copy.dart';
import '../../theme/tokens.dart';
import '../data/dashboard_snapshot.dart';
import '../logic/portfolio_allocation.dart';
import 'dashboard_card.dart';

/// Dashboard "Portfolio allocation" card (docs/dashboard.md §2.3). Brokerage
/// holdings only: a donut with the exact total Brokerage investments in the
/// centre plus a category / amount / percentage legend. Shows an "unavailable"
/// note when a holding can't be valued, and an empty note when there are no
/// Brokerage holdings yet — the card always renders on the dashboard, matching
/// the web.
class PortfolioAllocationCard extends StatelessWidget {
  const PortfolioAllocationCard({
    super.key,
    required this.items,
    required this.status,
    required this.currency,
  });

  final List<AllocationItem> items;
  final PortfolioAllocationStatus? status;
  final String currency;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final copy = DashboardCopy.of(AppLanguageScope.of(context).language);

    if (items.isEmpty) {
      final message = status == PortfolioAllocationStatus.incomplete
          ? copy.allocationUnavailable
          : copy.noBrokerage;
      return DashboardCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _title(context),
            const SizedBox(height: 4),
            Text(
              copy.brokerageSubtitle,
              style: TextStyle(color: c.inkMuted, fontSize: 12),
            ),
            const SizedBox(height: 14),
            Text(
              message,
              style: TextStyle(color: c.inkMuted, fontSize: 13, height: 1.5),
            ),
          ],
        ),
      );
    }

    final total = D.sum(items.map((i) => i.valueBase)) ?? '0';
    final palette = AppChartColors.of(c);
    final slices = <_Slice>[
      for (var i = 0; i < items.length; i++)
        _Slice(
          percent: double.tryParse(items[i].percentage) ?? 0,
          color: palette[i % palette.length],
        ),
    ];

    return DashboardCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _title(context),
          const SizedBox(height: 4),
          Text(
            copy.brokerageSubtitle,
            style: TextStyle(color: c.inkMuted, fontSize: 12),
          ),
          const SizedBox(height: 16),
          Center(
            child: SizedBox(
              width: 132,
              height: 132,
              child: CustomPaint(
                painter: _DonutPainter(slices: slices, track: c.canvas),
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        copy.invested,
                        style: TextStyle(
                          color: c.inkMuted,
                          fontSize: 9,
                          letterSpacing: 0.8,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 1),
                      Text(
                        MoneyFormat.compact(total),
                        textDirection: TextDirection.ltr,
                        style: TextStyle(
                          color: c.ink,
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          for (var i = 0; i < items.length; i++)
            _LegendRow(
              item: items[i],
              color: palette[i % palette.length],
              currency: currency,
              last: i == items.length - 1,
            ),
        ],
      ),
    );
  }

  Widget _title(BuildContext context) => Text(
    DashboardCopy.of(AppLanguageScope.of(context).language).portfolioAllocation,
    style: Theme.of(context).textTheme.titleSmall?.copyWith(
      color: context.colors.ink,
      fontWeight: FontWeight.w700,
    ),
  );
}

class _LegendRow extends StatelessWidget {
  const _LegendRow({
    required this.item,
    required this.color,
    required this.currency,
    required this.last,
  });

  final AllocationItem item;
  final Color color;
  final String currency;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: EdgeInsets.only(bottom: last ? 0 : 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 8,
            height: 8,
            margin: const EdgeInsets.only(top: 4),
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              DashboardCopy.of(AppLanguageScope.of(context).language).assetGroup(item.group.name),
              style: TextStyle(
                color: c.ink,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                MoneyFormat.money(item.valueBase, currency),
                textDirection: TextDirection.ltr,
                style: TextStyle(
                  color: c.ink,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                MoneyFormat.percent(item.percentage),
                textDirection: TextDirection.ltr,
                style: TextStyle(
                  color: c.inkMuted,
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Slice {
  const _Slice({required this.percent, required this.color});

  final double percent;
  final Color color;
}

class _DonutPainter extends CustomPainter {
  _DonutPainter({required this.slices, required this.track});

  final List<_Slice> slices;
  final Color track;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    const stroke = 15.0;
    final arcRect = rect.deflate(stroke / 2);

    canvas.drawArc(
      arcRect,
      0,
      2 * math.pi,
      false,
      Paint()
        ..color = track
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke,
    );

    final total = slices.fold<double>(0, (sum, s) => sum + s.percent);
    if (total <= 0) return;

    var start = -math.pi / 2;
    for (final slice in slices) {
      final sweep = slice.percent / total * 2 * math.pi;
      canvas.drawArc(
        arcRect,
        start,
        sweep,
        false,
        Paint()
          ..color = slice.color
          ..style = PaintingStyle.stroke
          ..strokeWidth = stroke
          ..strokeCap = StrokeCap.butt,
      );
      start += sweep;
    }
  }

  @override
  bool shouldRepaint(_DonutPainter old) =>
      old.slices != slices || old.track != track;
}
