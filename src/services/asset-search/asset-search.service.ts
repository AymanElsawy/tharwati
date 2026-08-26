import { supabase, type TypedSupabaseClient } from "@/lib/supabase/client"
import type { AssetSummary } from "@/lib/supabase/types"

const minimumQueryLength = 2

export type ExternalAssetSearchResult = {
  symbol: string
  name: string
  micCode: string
  exchange: string
  country: string
  currencyCode: string
  instrumentType: string
  provider: "twelve_data"
}

type EdgeSearchResult = {
  symbol?: unknown
  name?: unknown
  micCode?: unknown
  exchange?: unknown
  country?: unknown
  currencyCode?: unknown
  instrumentType?: unknown
  provider?: unknown
}

type EdgeSearchResponse = {
  available?: unknown
  results?: unknown
}

export class AssetSearchUnavailableError extends Error {
  constructor() {
    super("External asset search is temporarily unavailable")
    this.name = "AssetSearchUnavailableError"
  }
}

export class AssetResolutionError extends Error {
  constructor() {
    super("Unable to add the selected external asset")
    this.name = "AssetResolutionError"
  }
}

export function normalizeAssetSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ")
}

export function rankAssetSearchResults(
  results: ExternalAssetSearchResult[],
  query: string,
): ExternalAssetSearchResult[] {
  const normalizedQuery = normalizeAssetSearchQuery(query).toLocaleUpperCase()

  return results
    .map((result, index) => ({
      result,
      index,
      isExactSymbolMatch: result.symbol.toLocaleUpperCase() === normalizedQuery,
    }))
    .sort((left, right) => {
      if (left.isExactSymbolMatch !== right.isExactSymbolMatch) {
        return left.isExactSymbolMatch ? -1 : 1
      }
      return left.index - right.index
    })
    .map(({ result }) => result)
}

function normalizeResult(value: EdgeSearchResult): ExternalAssetSearchResult | null {
  const strings = [
    value.symbol,
    value.name,
    value.micCode,
    value.exchange,
    value.country,
    value.currencyCode,
    value.instrumentType,
  ]
  if (strings.some((item) => typeof item !== "string" || !item.trim())) return null
  if (value.provider !== "twelve_data") return null
  const currencyCode = (value.currencyCode as string).trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(currencyCode)) return null
  return {
    symbol: (value.symbol as string).trim(),
    name: (value.name as string).trim(),
    micCode: (value.micCode as string).trim().toUpperCase(),
    exchange: (value.exchange as string).trim(),
    country: (value.country as string).trim(),
    currencyCode,
    instrumentType: (value.instrumentType as string).trim(),
    provider: "twelve_data",
  }
}

export function parseAssetSearchResponse(response: EdgeSearchResponse): ExternalAssetSearchResult[] {
  if (response.available !== true || !Array.isArray(response.results)) {
    throw new AssetSearchUnavailableError()
  }
  return response.results.flatMap((item) =>
    item && typeof item === "object"
      ? [normalizeResult(item as EdgeSearchResult)].filter(
          (result): result is ExternalAssetSearchResult => result !== null,
        )
      : [],
  )
}

export class AssetSearchService {
  private readonly client: TypedSupabaseClient

  constructor(client: TypedSupabaseClient = supabase) {
    this.client = client
  }

  async search(query: string): Promise<ExternalAssetSearchResult[]> {
    const normalizedQuery = normalizeAssetSearchQuery(query)
    if (normalizedQuery.length < minimumQueryLength) return []
    const { data, error } = await this.client.functions.invoke<EdgeSearchResponse>(
      "asset-search",
      { body: { query: normalizedQuery } },
    )
    if (error) throw new AssetSearchUnavailableError()
    return rankAssetSearchResults(parseAssetSearchResponse(data ?? {}), normalizedQuery)
  }

  async resolve(result: ExternalAssetSearchResult): Promise<AssetSummary> {
    const { data, error } = await this.client.rpc(
      "resolve_external_brokerage_asset",
      {
        p_symbol: result.symbol,
        p_name: result.name,
        p_mic_code: result.micCode,
        p_display_exchange: result.exchange,
        p_country: result.country,
        p_currency_code: result.currencyCode,
        p_instrument_type: result.instrumentType,
      },
    )

    if (error || !data) throw new AssetResolutionError()
    return data
  }
}

export const assetSearchService = new AssetSearchService()
