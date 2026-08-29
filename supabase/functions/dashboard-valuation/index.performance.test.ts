import { describe, expect, it } from "vitest"

import source from "./index.ts?raw"

describe("dashboard valuation FX timing", () => {
  it("reports bounded FX batch wall time separately from summed request work", () => {
    expect(source).toContain('timing.measure("fx_request_sum"')
    expect(source).toContain('await timing.measure("fx_calls", () => resolveUniquePairsWithConcurrency(')
    expect(source).toContain("maxFxConcurrency")
  })

  it("keeps independent reads and market/metal provider work concurrent", () => {
    expect(source).toContain("const [balancesRead, valuationsRead, ownershipRead, holdingsRead, purchasesRead] = await Promise.all")
    expect(source).toContain("const [priceRows, metalPrices] = await Promise.all([priceRowsPromise, metalPricesPromise])")
    expect(source).toContain("maxMetalPriceConcurrency")
  })

  it("preserves ordered read error checks and explicit unavailable provider results", () => {
    expect(source).toContain('stage = "account_balances"')
    expect(source).toContain('stage = "holdings_query"')
    expect(source).toContain('stage = "metal_purchases"')
    expect(source).toContain("return [symbol, null] as const")
  })
})
