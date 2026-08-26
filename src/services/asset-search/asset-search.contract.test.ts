import { describe, expect, it } from "vitest"

import assetSearchFunction from "../../../supabase/functions/asset-search/index.ts?raw"

describe("asset-search Edge Function contract", () => {
  it("handles browser preflight and attaches CORS headers to every response", () => {
    expect(assetSearchFunction).toContain('"Access-Control-Allow-Origin": "*"')
    expect(assetSearchFunction).toContain('"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"')
    expect(assetSearchFunction).toContain('"Access-Control-Allow-Methods": "POST, OPTIONS"')
    expect(assetSearchFunction).toContain('if (request.method === "OPTIONS") return preflightResponse()')
    expect(assetSearchFunction).toContain('return new Response(null, { status: 204, headers: corsHeaders })')
    expect(assetSearchFunction).toContain('headers: { "Content-Type": "application/json", ...corsHeaders }')
  })

  it("keeps provider search authenticated, bounded, cached, and read-only", () => {
    expect(assetSearchFunction).toContain('userClient.auth.getUser()')
    expect(assetSearchFunction).toContain('https://api.twelvedata.com/symbol_search')
    expect(assetSearchFunction).toContain('const maximumResults = 10')
    expect(assetSearchFunction).toContain('const cacheDurationMs = 60_000')
    expect(assetSearchFunction).not.toContain('.from(')
    expect(assetSearchFunction).not.toContain('.rpc(')
  })
})
