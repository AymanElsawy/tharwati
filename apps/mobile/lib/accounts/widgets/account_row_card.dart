import 'package:flutter/material.dart';

import '../../core/decimals.dart';
import '../../core/money_format.dart';
import '../../theme/tokens.dart';
import '../account_models.dart';
import '../accounts_service.dart';
import 'account_type_icon.dart';

/// One account on the grouped list (canvas screen 11): type badge, name, a
/// type-specific subtitle, and the resolved Current Value (LTR, red when
/// negative, "Unavailable" while a value can't be resolved).
class AccountRowCard extends StatelessWidget {
  const AccountRowCard({
    super.key,
    required this.item,
    required this.onTap,
    this.deEmphasized = false,
  });

  final AccountItem item;
  final VoidCallback onTap;
  final bool deEmphasized;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final a = item.account;
    final amount = item.value.amount;
    final negative = amount != null && (D.compare(amount, '0') ?? 0) < 0;
    final nameColor = deEmphasized ? c.inkMuted : c.ink;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Opacity(
        opacity: deEmphasized ? 0.85 : 1,
        child: Container(
          constraints: const BoxConstraints(minHeight: 66),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: c.surface,
            border: Border.all(color: c.line),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            children: [
              AccountTypeIcon(type: a.type),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            a.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: nameColor,
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        if (a.isSold) ...[
                          const SizedBox(width: 6),
                          _Badge(label: 'SOLD', color: c.inkMuted),
                        ] else if (a.isClosed) ...[
                          const SizedBox(width: 6),
                          _Badge(label: 'CLOSED', color: c.inkMuted),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _subtitle(a),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: c.inkMuted, fontSize: 12),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Text(
                MoneyFormat.money(amount, a.currencyCode),
                textDirection: TextDirection.ltr,
                style: TextStyle(
                  color: item.value.isUnavailable
                      ? c.inkMuted
                      : (negative ? c.negative : nameColor),
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
              const SizedBox(width: 4),
              Icon(Icons.chevron_right, size: 18, color: c.inkMuted),
            ],
          ),
        ),
      ),
    );
  }

  String _subtitle(Account a) {
    switch (a.type) {
      case AccountType.bank:
        final parts = <String>[a.typeLabel];
        if (a.isBankCredit && a.creditCardLimit != null) {
          parts.add(
            'limit ${MoneyFormat.money(a.creditCardLimit, a.currencyCode)}',
          );
          if (a.dueDayOfMonth != null) parts.add('due ${a.dueDayOfMonth}');
        }
        return parts.join(' · ');
      case AccountType.gold:
        final grams = a.balanceGrams;
        final parts = <String>[
          if (a.purity != null) a.purity!.toUpperCase(),
          if (grams != null)
            '${MoneyFormat.money(grams, 'g').replaceAll(' g', '')} g',
        ];
        return parts.isEmpty ? a.typeLabel : parts.join(' · ');
      case AccountType.brokerage:
        final label = switch (a.investmentType) {
          'stock_etf' => 'Stocks & ETFs',
          'crypto' => 'Crypto',
          _ => 'Mixed',
        };
        return '$label · ${a.currencyCode}';
      case AccountType.realEstate:
        return [
          if (a.propertyType != null) _cap(a.propertyType!),
          if (a.ownershipPercentage != null)
            '${_trimPct(a.ownershipPercentage!)}% owned',
        ].join(' · ');
      case AccountType.business:
        return [
          if (a.ownershipPercentage != null)
            '${_trimPct(a.ownershipPercentage!)}% owned',
        ].join(' · ');
      case AccountType.cash:
      case AccountType.other:
        return a.currencyCode;
    }
  }

  static String _cap(String s) =>
      s.isEmpty ? s : '${s[0].toUpperCase()}${s.substring(1)}';

  static String _trimPct(String s) {
    final n = double.tryParse(s);
    if (n == null) return s;
    return n == n.roundToDouble() ? n.toStringAsFixed(0) : s;
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: context.colors.fieldFill,
        borderRadius: BorderRadius.circular(AppRadius.chip),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 9,
          letterSpacing: 0.6,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
