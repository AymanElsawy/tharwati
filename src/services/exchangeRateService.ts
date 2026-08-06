const EXCHANGE_RATE_API_URL =
  "https://v6.exchangerate-api.com/v6/5fedc0613f28952325520033/latest/USD"

type ExchangeRateApiResponse = {
  result: string
  conversion_rates?: Record<string, number>
}

let cachedRates: Record<string, number> | null = null
let pendingRequest: Promise<Record<string, number>> | null = null

function normalizeCurrencyCode(currencyCode: string) {
  return currencyCode.trim().toUpperCase()
}

async function loadRates(): Promise<Record<string, number>> {
  try {
    const response = await fetch(EXCHANGE_RATE_API_URL)
    if (!response.ok) {
      throw new Error(`ExchangeRate-API request failed with ${response.status}`)
    }

    const payload = (await response.json()) as ExchangeRateApiResponse
    if (payload.result !== "success" || !payload.conversion_rates) {
      throw new Error("ExchangeRate-API returned an invalid rates response")
    }

    const rates = Object.fromEntries(
      Object.entries(payload.conversion_rates).filter(
        ([, rate]) => Number.isFinite(rate) && rate > 0,
      ),
    )
    if (!Number.isFinite(rates.USD) || rates.USD <= 0) {
      throw new Error("ExchangeRate-API response does not contain a valid USD rate")
    }

    cachedRates = rates
    return rates
  } catch (error) {
    console.error("Unable to fetch live exchange rates", error)
    if (cachedRates) return cachedRates
    return { USD: 1 }
  }
}

async function getRates() {
  if (cachedRates) return cachedRates
  pendingRequest ??= loadRates().finally(() => {
    pendingRequest = null
  })
  return pendingRequest
}

/** Returns the live USD-to-currency rate, cached for the life of the app. */
export async function getExchangeRate(currencyCode: string): Promise<number> {
  const code = normalizeCurrencyCode(currencyCode)
  if (code === "USD") return 1
  const rates = await getRates()
  const rate = rates[code]
  if (!Number.isFinite(rate) || rate <= 0) {
    console.error(`No live exchange rate is available for ${code}`)
    return 1
  }
  return rate
}

/** Converts a USD amount to the requested currency using the cached live rate. */
export async function convertUsd(
  amount: number,
  currencyCode: string,
): Promise<number> {
  return amount * (await getExchangeRate(currencyCode))
}

/** Resolves any currency pair through their USD rates. */
export async function getCurrencyConversionRate(
  sourceCurrencyCode: string,
  destinationCurrencyCode: string,
): Promise<number> {
  const source = normalizeCurrencyCode(sourceCurrencyCode)
  const destination = normalizeCurrencyCode(destinationCurrencyCode)
  if (source === destination) return 1
  const [sourceRate, destinationRate] = await Promise.all([
    getExchangeRate(source),
    getExchangeRate(destination),
  ])
  return destinationRate / sourceRate
}

/** Starts the single live-rate request without blocking application rendering. */
export function preloadExchangeRates() {
  void getRates()
}
