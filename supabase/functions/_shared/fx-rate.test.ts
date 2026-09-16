import { describe, expect, it } from "vitest"
import { identityRate, positiveRate, providerCacheState } from "./fx-rate.ts"

const freshnessMs = 6 * 60 * 60 * 1000
const now = Date.parse("2026-09-16T12:00:00Z")

describe("FX cache contract", () => {
  it("returns SAR/SAR identity without a provider or stored rate", () => {
    expect(identityRate("2026-09-16", "2026-09-16T12:00:00Z")).toMatchObject({
      rate: 1,
      provider: "identity",
      stale: false,
      unavailable: false,
    })
  })

  it("recognizes a fresh positive provider cache row", () => {
    expect(providerCacheState({
      rate: "3.750000000000",
      effective_at: "2026-09-16T00:00:00Z",
      fetched_at: "2026-09-16T10:00:00Z",
    }, { historical: false, now, freshnessMs })).toMatchObject({ rate: 3.75, fresh: true })
  })

  it("preserves a stale positive row for provider-failure fallback", () => {
    expect(providerCacheState({
      rate: "3.750000000000",
      effective_at: "2026-09-15T00:00:00Z",
      fetched_at: "2026-09-15T00:00:00Z",
    }, { historical: false, now, freshnessMs })).toMatchObject({ rate: 3.75, fresh: false })
  })

  it.each([null, undefined, "", "malformed", "0", 0, "-1", -1, "NaN", Infinity])(
    "rejects invalid stored rate %s rather than substituting zero",
    (value) => expect(positiveRate(value)).toBeNull(),
  )
})
