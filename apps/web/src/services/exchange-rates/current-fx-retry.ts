function currency(value: string) {
  return value.trim().toUpperCase()
}

/**
 * The shared FX contract accepts normalized three-letter currency pairs and
 * decides provider/manual availability server-side. Retry classification must
 * not duplicate a provider capability list in the browser.
 */
export function isRetryableCurrentFxPair(
  sourceCurrencyCode: string,
  destinationCurrencyCode: string,
) {
  const source = currency(sourceCurrencyCode)
  const destination = currency(destinationCurrencyCode)
  return /^[A-Z]{3}$/.test(source) &&
    /^[A-Z]{3}$/.test(destination) &&
    source !== destination
}
