import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/decimals.dart';
import '../../core/money_format.dart';
import '../../theme/tokens.dart';
import '../logic/dashboard_aggregate.dart';
import 'dashboard_card.dart';

const _labels = <AssetGroup, String>{
  AssetGroup.cashAndBank: 'Cash & bank',
  AssetGroup.brokerage: 'Brokerage',
  AssetGroup.goldAndSilver: 'Gold & silver',
  AssetGroup.realEstate: 'Real estate',
  AssetGroup.business: 'Business',
  AssetGroup.certificates: 'Certificates',
  AssetGroup.other: 'Other',
};

class AssetsBreakdownCard extends StatelessWidget {
  const AssetsBreakdownCard({super.key, required this.aggregate});

  final DashboardAggregate aggregate;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;

    if (aggregate.isEmpty) {
      return DashboardCard(
        dashed: true,
        child: Column(
          children: [
            Container(
              width: 46,
              height: 46,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: c.canvas,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(Icons.insights_outlined, size: 22, color: c.inkMuted),
            ),
            const SizedBox(height: 10),
            Text(
              'No breakdown yet',
              style: TextStyle(
                color: c.ink,
                fontSize: 15,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Allocation appears once at least one account holds a value.',
              textAlign: TextAlign.center,
              style: TextStyle(color: c.inkMuted, fontSize: 13, height: 1.5),
            ),
          ],
        ),
      );
    }

    if (aggregate.status == AggregateStatus.incomplete) {
      return DashboardCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _Header(),
            const SizedBox(height: 12),
            Text(
              'Breakdown is unavailable while a value or exchange rate is '
              'missing.',
              style: TextStyle(color: c.inkMuted, fontSize: 13, height: 1.5),
            ),
          ],
        ),
      );
    }

    final total = aggregate.totalAssets ?? '0';
    final slices = <_Slice>[];
    final palette = AppChartColors.of(c);
    var colorIndex = 0;
    for (final group in AssetGroup.values) {
      final value = aggregate.assetBreakdown[group];
      if (value == null || !D.isPositive(value)) continue;
      final pct = D.multiply(D.divide(value, total, scale: 6), '100') ?? '0';
      slices.add(
        _Slice(
          label: _labels[group]!,
          value: value,
          percent: pct,
          color: palette[colorIndex % palette.length],
        ),
      );
      colorIndex++;
    }

    return DashboardCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Header(),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              SizedBox(
                width: 96,
                height: 96,
                child: CustomPaint(
                  painter: _DonutPainter(slices: slices, track: c.canvas),
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'TOTAL',
                          style: TextStyle(
                            color: c.inkMuted,
                            fontSize: 9,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Text(
                          MoneyFormat.compact(total),
                          textDirection: TextDirection.ltr,
                          style: TextStyle(
                            color: c.ink,
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  children: [
                    for (final slice in slices) ...[
                      _LegendRow(
                        slice: slice,
                        currency: aggregate.baseCurrencyCode,
                      ),
                      if (slice != slices.last) const SizedBox(height: 9),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          'Assets breakdown',
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
            color: c.ink,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

class _LegendRow extends StatelessWidget {
  const _LegendRow({required this.slice, required this.currency});

  final _Slice slice;
  final String currency;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Row(
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: slice.color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            slice.label,
            style: TextStyle(
              color: c.ink,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        Text(
          MoneyFormat.percent(slice.percent),
          textDirection: TextDirection.ltr,
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

class _Slice {
  const _Slice({
    required this.label,
    required this.value,
    required this.percent,
    required this.color,
  });

  final String label;
  final String value;
  final String percent;
  final Color color;
}

class _DonutPainter extends CustomPainter {
  _DonutPainter({required this.slices, required this.track});

  final List<_Slice> slices;
  final Color track;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final stroke = 13.0;
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

    final total = slices.fold<double>(
      0,
      (sum, s) => sum + (double.tryParse(s.percent) ?? 0),
    );
    if (total <= 0) return;

    var start = -math.pi / 2;
    for (final slice in slices) {
      final sweep = (double.tryParse(slice.percent) ?? 0) / total * 2 * math.pi;
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
