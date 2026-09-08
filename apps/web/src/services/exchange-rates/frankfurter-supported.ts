const supportedCurrencies = new Set([
  "AUD", "BGN", "BRL", "CAD", "CHF", "CNY", "CZK", "DKK", "EGP", "EUR",
  "GBP", "HKD", "HUF", "IDR", "ILS", "INR", "ISK", "JPY", "KRW", "MXN",
  "MYR", "NOK", "NZD", "PHP", "PLN", "RON", "SEK", "SGD", "THB", "TRY",
  "USD", "ZAR",
])

export function isFrankfurterSupportedPair(
  sourceCurrencyCode: string,
  destinationCurrencyCode: string,
) {
  return supportedCurrencies.has(sourceCurrencyCode.toUpperCase()) &&
    supportedCurrencies.has(destinationCurrencyCode.toUpperCase())
}
