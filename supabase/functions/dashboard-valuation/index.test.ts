import { describe, expect, it } from "vitest"
import source from "./index.ts?raw"

describe("dashboard valuation non-market account values", () => {
  it("forwards the caller JWT and the public API key to RLS-scoped reads and child functions", () => {
    expect(source).toContain('projectApiKey("publishable")')
    expect(source).toContain("createClient(url, publishableKey, { global: { headers: { Authorization: authorization } } })")
    expect(source).toContain("headers: { Authorization: authorization, apikey: publishableKey")
    expect(source).not.toContain("SUPABASE_ANON_KEY")
  })
  it("uses effective valuations and ownership rather than legacy opening balances", () => {
    expect(source).toContain("get_effective_account_valuations")
    expect(source).toContain("latestValuations")
    expect(source).toContain("multiply(valuation, ownership)")
  })
})
