import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/accounts/records/account_records_page.dart';
import 'package:tharwati_mobile/accounts/records/record_form_sheet.dart';
import 'package:tharwati_mobile/accounts/records/records_models.dart';
import 'package:tharwati_mobile/theme/tokens.dart';

void main() {
  for (final colors in [AppColors.light, AppColors.dark]) {
    final mode = colors.isDark ? 'dark' : 'light';

    test('$mode Account Records use semantic foregrounds', () {
      expect(accountRecordAmountColor(colors, 'income'), colors.positive);
      expect(accountRecordAmountColor(colors, 'refund'), colors.positive);
      expect(accountRecordAmountColor(colors, 'expense'), colors.negative);
      expect(accountRecordAmountColor(colors, 'transfer'), colors.ink);
      expect(accountRecordNetColor(colors, '25.00'), colors.positive);
      expect(accountRecordNetColor(colors, '-25.00'), colors.negative);
      expect(accountRecordNetColor(colors, '0.00'), colors.inkMuted);
      expect(accountRecordNetColor(colors, '-0.00'), colors.inkMuted);
    });

    test('$mode Record type selection follows the theme', () {
      expect(
        recordTypeSelectionColor(colors, AccountRecordType.income),
        colors.positive,
      );
      expect(
        recordTypeSelectionColor(colors, AccountRecordType.expense),
        colors.negative,
      );
      expect(
        recordTypeSelectionColor(colors, AccountRecordType.transfer),
        colors.ink,
      );
      expect(colors.positive, isNot(colors.accent));
    });
  }

  test(
    'brand gold remains reserved for the dark accent and metal identity',
    () {
      expect(AppColors.dark.accent, AppColors.dark.metal);
      expect(AppColors.dark.artworkGold, AppColors.dark.accent);
    },
  );
}
