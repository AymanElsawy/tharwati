import { describe, expect, it, vi } from "vitest"
import { twelveDataHttpRateLimit, twelveDataRateLimit } from "./twelve-data-errors.ts"

describe("safe Twelve Data throttle metadata", () => {
  it("requires the documented error status/code and ignores provider messages", () => {
    expect(twelveDataRateLimit({ status: "error", code: 400 })).toBeNull()
    expect(twelveDataRateLimit({ code: 429 })).toBeNull()
    expect(twelveDataRateLimit(null)).toBeNull()
    expect(twelveDataRateLimit({ status: "error", code: 429, message: "private" }))
      .toMatchObject({ message: "provider_refresh_rate_limited", retryAfterSeconds: 60 })
  })
  it("accepts numeric/date Retry-After and bounds or defaults invalid values", () => {
    const payload = { status: "error", code: 429 }
    expect(twelveDataRateLimit(payload, "2.5")?.retryAfterSeconds).toBe(3)
    expect(twelveDataRateLimit(payload, "999999")?.retryAfterSeconds).toBe(86400)
    expect(twelveDataRateLimit(payload, "private")?.retryAfterSeconds).toBe(60)
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-09T00:00:00Z"))
    try {
      expect(twelveDataRateLimit(payload, "Fri, 09 Oct 2026 00:00:30 GMT")?.retryAfterSeconds).toBe(30)
    } finally { vi.restoreAllMocks() }
    expect(twelveDataHttpRateLimit(new Response("not JSON", { status: 429 }))?.retryAfterSeconds).toBe(60)
  })
})
