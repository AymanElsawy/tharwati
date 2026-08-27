const api = "https://api.frankfurter.dev/v2"

export type FrankfurterRate = {
  date: string
  base: string
  quote: string
  rate: number
}

function validRate(value: unknown, from: string, to: string, requestedDate?: string): value is FrankfurterRate {
  if (!value || typeof value !== "object") return false
  const rate = value as Partial<FrankfurterRate>
  return rate.base === from && rate.quote === to && typeof rate.date === "string" &&
    (!requestedDate || rate.date <= requestedDate) && typeof rate.rate === "number" &&
    Number.isFinite(rate.rate) && rate.rate > 0
}

export async function getFrankfurterRate(from: string, to: string, requestedDate?: string): Promise<FrankfurterRate> {
  const url = new URL(requestedDate ? `${api}/rates` : `${api}/rate/${from}/${to}`)
  if (requestedDate) {
    const start = new Date(`${requestedDate}T00:00:00Z`)
    start.setUTCDate(start.getUTCDate() - 10)
    url.searchParams.set("base", from)
    url.searchParams.set("quotes", to)
    url.searchParams.set("from", start.toISOString().slice(0, 10))
    url.searchParams.set("to", requestedDate)
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    try {
      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok) throw new Error(`Frankfurter returned ${response.status}`)
      const payload = await response.json()
      const rate = requestedDate && Array.isArray(payload)
        ? payload.filter((row) => validRate(row, from, to, requestedDate)).sort((left, right) => right.date.localeCompare(left.date))[0]
        : payload
      if (!validRate(rate, from, to, requestedDate)) throw new Error("Frankfurter returned an invalid rate response")
      return rate
    } catch (error) {
      const retryable = error instanceof TypeError ||
        (error instanceof Error && (
          error.name === "AbortError" || /^Frankfurter returned 5\d\d$/.test(error.message)
        ))
      if (!retryable || attempt === 1) throw error
    } finally {
      clearTimeout(timeout)
    }
  }
  throw new Error("Frankfurter rate request failed")
}
