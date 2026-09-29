import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/accounts/account_models.dart';
import 'package:tharwati_mobile/accounts/metal/metal_gain_style.dart';
import 'package:tharwati_mobile/accounts/widgets/account_type_icon.dart';
import 'package:tharwati_mobile/theme/tokens.dart';

void main() {
  for (final colors in [AppColors.light, AppColors.dark]) {
    final mode = colors.isDark ? 'Dark' : 'Light';

    for (final metal in ['Gold', 'Silver']) {
      test('$metal unrealized gain uses semantic colors in $mode', () {
        final accountGain = metalGainTextStyle(colors, '100.00', fontSize: 14);
        final purityGain = metalGainTextStyle(colors, '100.00', fontSize: 13);
        for (final style in [accountGain, purityGain]) {
          expect(style.color, colors.positive);
          expect(style.color, isNot(colors.accent));
          expect(style.fontWeight, FontWeight.w700);
          expect(style.color!.a, 1);
        }
        expect(accountGain.fontSize, 14);
        expect(purityGain.fontSize, 13);

        expect(
          metalGainTextStyle(colors, '-100.00', fontSize: 14).color,
          colors.negative,
        );
        expect(
          metalGainTextStyle(colors, '0.00', fontSize: 14).color,
          colors.inkMuted,
        );
        expect(
          metalGainTextStyle(colors, '-0.00', fontSize: 13).color,
          colors.inkMuted,
        );
      });
    }

    testWidgets('metal icon badge keeps the metal palette in $mode', (
      tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(extensions: [colors]),
          home: const Scaffold(body: AccountTypeIcon(type: AccountType.gold)),
        ),
      );

      final icon = tester.widget<Icon>(find.byType(Icon));
      final badge = tester.widget<Container>(
        find.descendant(
          of: find.byType(AccountTypeIcon),
          matching: find.byType(Container),
        ),
      );
      expect(icon.color, colors.metal);
      expect((badge.decoration as BoxDecoration).color, colors.metalSoft);
    });
  }
}
