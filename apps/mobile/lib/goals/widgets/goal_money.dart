import 'package:flutter/material.dart';

import '../../core/money_format.dart';
import '../../theme/tokens.dart';

/// `"−500,000 EGP"` / `"+900 EGP"` — sign first, grouped amount (2dp), ISO code
/// last. Port of the web `formatGoalMoney`. [sign] is explicit because stored
/// amounts are always positive; pass `'+'` / `'−'` for history rows.
String goalMoney(String? amount, String currencyCode, {String? sign}) {
  final body = MoneyFormat.money(amount, currencyCode);
  return sign == null ? body : '$sign$body';
}

/// The same string in an LTR-isolated [Text] so it renders stably on an RTL page
/// (port of the web `<GoalMoney>` component).
class GoalMoney extends StatelessWidget {
  const GoalMoney({
    super.key,
    required this.amount,
    required this.currencyCode,
    this.sign,
    this.style,
  });

  final String? amount;
  final String currencyCode;
  final String? sign;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    return Text(
      goalMoney(amount, currencyCode, sign: sign),
      textDirection: TextDirection.ltr,
      style: (style ?? TextStyle(color: context.colors.ink, fontSize: 13))
          .copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
    );
  }
}
