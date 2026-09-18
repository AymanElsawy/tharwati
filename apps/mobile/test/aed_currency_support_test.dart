import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/accounts/account_models.dart';
import 'package:tharwati_mobile/core/money_format.dart';
import 'package:tharwati_mobile/goals/goal_models.dart';
import 'package:tharwati_mobile/i18n/accounts_copy.dart';
import 'package:tharwati_mobile/i18n/app_language.dart';
import 'package:tharwati_mobile/onboarding/data/country_currency.dart';
import 'package:tharwati_mobile/onboarding/data/currencies.dart';

void main() {
  test('UAE onboarding defaults to supported AED metadata', () {
    expect(defaultCurrencyCode('AE'), 'AED');
    expect(findSupportedCurrency('AED')?.name, 'United Arab Emirates Dirham');
    expect(findSupportedCurrency('AED')?.symbol, 'د.إ');
  });

  test(
    'account and goal lists add AED without dropping existing currencies',
    () {
      const expected = {'USD', 'SAR', 'EGP', 'EUR', 'GBP', 'AED'};
      expect(kAccountCurrencies.toSet(), containsAll(expected));
      expect(goalCurrencies.toSet(), containsAll(expected));
      expect(
        kSupportedCurrencies.map((currency) => currency.code).toSet(),
        containsAll(expected),
      );
    },
  );

  test('AED money preserves ISO suffix formatting', () {
    expect(MoneyFormat.money('1234.5', 'AED'), '1,234.50 AED');
    expect(
      AccountsCopy.of(AppLanguage.en).currencyLabel('AED'),
      contains('UAE Dirham'),
    );
    expect(
      AccountsCopy.of(AppLanguage.ar).currencyLabel('AED'),
      contains('الدرهم الإماراتي'),
    );
  });
}
