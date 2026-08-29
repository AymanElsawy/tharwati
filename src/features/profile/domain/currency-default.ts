const supportedCurrencyCodes = ["USD", "SAR", "EGP", "EUR", "GBP"] as const

export type SupportedCurrencyCode = (typeof supportedCurrencyCodes)[number]

export function getProfileCurrencyDefault(
  baseCurrencyCode: string | null | undefined,
): SupportedCurrencyCode {
  const normalized = baseCurrencyCode?.trim().toUpperCase()
  return supportedCurrencyCodes.includes(normalized as SupportedCurrencyCode)
    ? (normalized as SupportedCurrencyCode)
    : "USD"
}
