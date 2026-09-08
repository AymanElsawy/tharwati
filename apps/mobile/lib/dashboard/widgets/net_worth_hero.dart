import 'package:flutter/material.dart';

import '../../core/money_format.dart';
import '../../theme/tokens.dart';
import '../logic/dashboard_aggregate.dart';

/// The net-worth hero card (Dashboard artboards 07/08/10). Assumes the load
/// already succeeded — the loading / transport-error / no-base-currency states
/// live on the screen, not here. Renders one of: complete, incomplete, empty.
class NetWorthHero extends StatelessWidget {
  const NetWorthHero({
    super.key,
    required this.aggregate,
    required this.animateTotal,
    this.onAddAccount,
  });

  final DashboardAggregate aggregate;

  /// Run the count-up once (false on silent refreshes and reduced motion).
  final bool animateTotal;
  final VoidCallback? onAddAccount;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final currency = aggregate.baseCurrencyCode;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: c.surface,
        border: Border.all(color: c.line),
        borderRadius: BorderRadius.circular(AppRadius.card),
        boxShadow: [
          BoxShadow(
            color: c.ink.withValues(alpha: c.isDark ? 0.0 : 0.10),
            blurRadius: 30,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'NET WORTH',
                      style: TextStyle(
                        color: c.inkMuted,
                        fontSize: 11,
                        letterSpacing: 1.4,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      aggregate.isEmpty
                          ? 'Sum of the accounts you add'
                          : 'Across ${aggregate.accountCount} '
                                '${aggregate.accountCount == 1 ? "account" : "accounts"} · $currency',
                      style: TextStyle(color: c.inkMuted, fontSize: 12),
                    ),
                  ],
                ),
              ),
              Container(
                width: 36,
                height: 36,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: c.accentSoft,
                  borderRadius: BorderRadius.circular(11),
                ),
                child: Icon(
                  Icons.account_balance_wallet_outlined,
                  size: 18,
                  color: c.accent,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          if (aggregate.status == AggregateStatus.incomplete)
            _IncompleteBody(aggregate: aggregate)
          else ...[
            _Total(
              value: aggregate.netWorth ?? '0',
              currency: currency,
              animate: animateTotal,
            ),
            const SizedBox(height: 12),
            if (aggregate.isEmpty)
              _EmptyBody(onAddAccount: onAddAccount)
            else
              _AssetLiabilityRow(aggregate: aggregate),
          ],
        ],
      ),
    );
  }
}

class _Total extends StatelessWidget {
  const _Total({
    required this.value,
    required this.currency,
    required this.animate,
  });

  final String value;
  final String currency;
  final bool animate;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final style = TextStyle(
      color: c.ink,
      fontSize: 31,
      height: 1.1,
      letterSpacing: -0.9,
      fontWeight: FontWeight.w800,
      fontFeatures: const [FontFeature.tabularFigures()],
    );
    final text = MoneyFormat.money(value, currency);
    if (!animate) {
      return Text(text, textDirection: TextDirection.ltr, style: style);
    }
    final target = double.tryParse(value) ?? 0;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: target),
      duration: const Duration(milliseconds: 500),
      curve: Curves.easeOutCubic,
      builder: (context, v, _) => Text(
        MoneyFormat.money(v.toStringAsFixed(2), currency),
        textDirection: TextDirection.ltr,
        style: style,
      ),
    );
  }
}

class _AssetLiabilityRow extends StatelessWidget {
  const _AssetLiabilityRow({required this.aggregate});

  final DashboardAggregate aggregate;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final currency = aggregate.baseCurrencyCode;
    Widget tile(String label, String? amount, Color valueColor) => Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
        decoration: BoxDecoration(
          color: c.fieldFill,
          borderRadius: BorderRadius.circular(13),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: TextStyle(
                color: c.inkMuted,
                fontSize: 10,
                letterSpacing: 1,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              MoneyFormat.money(amount, currency),
              textDirection: TextDirection.ltr,
              style: TextStyle(
                color: valueColor,
                fontSize: 14,
                fontWeight: FontWeight.w700,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ],
        ),
      ),
    );

    return Row(
      children: [
        tile('ASSETS', aggregate.totalAssets, c.ink),
        const SizedBox(width: 8),
        tile(
          'LIABILITIES',
          aggregate.totalLiabilities == null
              ? null
              : MoneyFormat.signedMoney(
                  '-${aggregate.totalLiabilities}',
                  currency,
                ),
          c.negative,
        ),
      ],
    );
  }
}

class _IncompleteBody extends StatelessWidget {
  const _IncompleteBody({required this.aggregate});

  final DashboardAggregate aggregate;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final missingFx = aggregate.unavailablePairs.isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Totals unavailable',
          style: TextStyle(
            color: c.ink,
            fontSize: 22,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          missingFx
              ? 'An exchange rate is missing, so we can’t total your accounts '
                    'right now. Nothing partial is shown.'
              : 'One or more accounts have no current value yet, so we can’t '
                    'total your net worth. Nothing partial is shown.',
          style: TextStyle(color: c.inkMuted, fontSize: 13, height: 1.5),
        ),
      ],
    );
  }
}

class _EmptyBody extends StatelessWidget {
  const _EmptyBody({required this.onAddAccount});

  final VoidCallback? onAddAccount;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Nothing tracked yet. Your net worth is the sum of the accounts you '
          'add.',
          style: TextStyle(color: c.inkMuted, fontSize: 13, height: 1.5),
        ),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: onAddAccount,
          child: const Text('Add your first account'),
        ),
      ],
    );
  }
}
