export type StoredProviderRate = {
  rate: string | number
  effective_at: string
  fetched_at: string
}

export function positiveRate(value: unknown): number | null {
  const rate = Number(value)
  return Number.isFinite(rate) && rate > 0 ? rate : null
}

export function providerCacheState(
  row: StoredProviderRate | null,
  options: { historical: boolean; now: number; freshnessMs: number },
) {
  const rate = positiveRate(row?.rate)
  if (!row || rate === null || Number.isNaN(Date.parse(row.fetched_at))) return null
  return {
    rate,
    effectiveAt: row.effective_at,
    fetchedAt: row.fetched_at,
    fresh: options.historical || options.now - Date.parse(row.fetched_at) < options.freshnessMs,
  }
}

export function identityRate(effectiveAt: string, fetchedAt: string) {
  return {
    available: true,
    rate: 1,
    provider: "identity" as const,
    effectiveAt,
    fetchedAt,
    stale: false,
    unavailable: false,
  }
}
