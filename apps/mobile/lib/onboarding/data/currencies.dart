/// The five currencies the rest of the app (accounts, reports) supports today.
/// Mirrors `supportedCurrencies` in the web app
/// (`src/features/onboarding/data/currencies.ts`). `base_currency_code` on
/// `profiles` has a CHECK constraint limiting it to exactly these codes.
class Currency {
  const Currency(this.code, this.name, this.symbol);

  final String code;
  final String name;
  final String symbol;
}

const List<Currency> kSupportedCurrencies = <Currency>[
  Currency('EGP', 'Egyptian Pound', 'E£'),
  Currency('EUR', 'Euro', '€'),
  Currency('GBP', 'British Pound', '£'),
  Currency('SAR', 'Saudi Riyal', 'SR'),
  Currency('USD', 'US Dollar', r'$'),
];

Currency? findSupportedCurrency(String? code) {
  if (code == null) return null;
  for (final currency in kSupportedCurrencies) {
    if (currency.code == code) return currency;
  }
  return null;
}
