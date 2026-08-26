import { describe, expect, it } from "vitest"

import marketPricesFunction from "../../../supabase/functions/market-prices/index.ts?raw"

describe("market-prices generic Twelve Data resolution contract", () => {
  it("handles CORS preflight with the shared asset-search headers", () => {
    expect(marketPricesFunction).toContain("const corsHeaders = {")
    expect(marketPricesFunction).toContain('"Access-Control-Allow-Origin": "*"')
    expect(marketPricesFunction).toContain('"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"')
    expect(marketPricesFunction).toContain('"Access-Control-Allow-Methods": "POST, OPTIONS"')
    expect(marketPricesFunction).toContain('if (request.method === "OPTIONS") return preflightResponse()')
    expect(marketPricesFunction).toContain("status: 204, headers: corsHeaders")
  })

  it("includes CORS headers on success and error JSON responses", () => {
    expect(marketPricesFunction).toContain('headers: { "Content-Type": "application/json", ...corsHeaders }')
    expect(marketPricesFunction).toContain('return json({ error: "method_not_allowed" }, 405)')
    expect(marketPricesFunction).toContain('return json({ prices: assets.map((asset) => results.get(asset.id)!).filter(Boolean) })')
  })

  it("uses only a server-loaded Twelve Data identifier for accessible pending assets", () => {
    expect(marketPricesFunction).not.toContain("usProofInstruments")
    expect(marketPricesFunction).toContain("const userClient = createClient(url, anon")
    expect(marketPricesFunction).toContain('.from("assets")')
    expect(marketPricesFunction).toContain('.from("asset_identifiers")')
    expect(marketPricesFunction).toContain('.eq("scheme", "provider")')
    expect(marketPricesFunction).toContain('.eq("provider", provider)')
    expect(marketPricesFunction).toContain("resolveTwelveDataInstrument(asset, identifiers)")
    expect(marketPricesFunction).toContain(".in(\"asset_id\", pending.map((asset) => asset.id))")
  })

  it("keeps the existing fresh-cache and stale/manual fallback paths", () => {
    expect(marketPricesFunction).toContain("if (row.provider === provider && !fresh.has(row.asset_id) && isFresh(row))")
    expect(marketPricesFunction).toContain("const stalePrice = stale.get(asset.id)")
    expect(marketPricesFunction).toContain("else if (manual.has(asset.id))")
    expect(marketPricesFunction).toContain("market-prices provider request failed")
  })

  it("uses the persisted MIC code for price and quote requests", () => {
    expect(marketPricesFunction).toContain("mic_code: micCode")
    expect(marketPricesFunction).toContain("const byMicCode = new Map<string, typeof mapped>()")
    expect(marketPricesFunction).toContain('quoteUrl("price", symbols, micCode, apiKey)')
    expect(marketPricesFunction).toContain('quoteUrl(')
    expect(marketPricesFunction).toContain('"quote",')
  })
})
