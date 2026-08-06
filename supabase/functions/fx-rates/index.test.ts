import { describe, expect, it, vi } from "vitest"
import { getFrankfurterRate } from "../_shared/frankfurter.ts"

describe("fx-rates Frankfurter provider", () => {
  it("selects the latest valid mocked historical response", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([
    { base: "USD", quote: "SAR", date: "2026-08-02", rate: 3.75 },
    { base: "USD", quote: "SAR", date: "2026-08-04", rate: 3.76 },
    { base: "USD", quote: "SAR", date: "2026-08-06", rate: 3.77 },
    ])))
    const rate = await getFrankfurterRate("USD", "SAR", "2026-08-05")
    expect(rate).toEqual({ base: "USD", quote: "SAR", date: "2026-08-04", rate: 3.76 })
    fetchMock.mockRestore()
  })
})
