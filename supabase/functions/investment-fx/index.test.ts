import { describe, expect, it, vi } from "vitest"
import { getFrankfurterRate } from "../_shared/frankfurter.ts"

describe("investment-fx Frankfurter provider", () => {
  it("rejects an invalid mocked historical response", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([
    { base: "USD", quote: "SAR", date: "2026-08-06", rate: 3.75 },
    ])))
    try {
      await expect(getFrankfurterRate("USD", "SAR", "2026-08-05")).rejects.toThrow("invalid rate response")
    } finally {
      fetchMock.mockRestore()
    }
  })
})
