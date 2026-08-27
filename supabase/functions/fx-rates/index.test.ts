import { describe, expect, it, vi } from "vitest"
import { getFrankfurterRate } from "../_shared/frankfurter.ts"

describe("fx-rates Frankfurter provider", () => {
  it("returns a usable current USD/EGP rate", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(
      { base: "USD", quote: "EGP", date: "2026-08-27", rate: 50.305 },
    )))
    await expect(getFrankfurterRate("USD", "EGP")).resolves.toEqual(
      { base: "USD", quote: "EGP", date: "2026-08-27", rate: 50.305 },
    )
    fetchMock.mockRestore()
  })

  it.each([
    ["EGP", "SAR", 0.07454],
    ["EUR", "SAR", 4.3738],
    ["GBP", "SAR", 5.1012],
  ])("preserves %s/%s current response parsing", async (from, to, value) => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(
      { base: from, quote: to, date: "2026-08-27", rate: value },
    )))
    await expect(getFrankfurterRate(from, to)).resolves.toMatchObject({ rate: value })
    fetchMock.mockRestore()
  })

  it("retries one transient provider failure before returning unavailable to its caller", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(
        { base: "USD", quote: "EGP", date: "2026-08-27", rate: 50.305 },
      )))
    await expect(getFrankfurterRate("USD", "EGP")).resolves.toMatchObject({ rate: 50.305 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    fetchMock.mockRestore()
  })

  it("keeps an unavailable provider response explicit after the retry", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("unavailable", { status: 503 }))
    await expect(getFrankfurterRate("USD", "EGP")).rejects.toThrow("Frankfurter returned 503")
    expect(fetchMock).toHaveBeenCalledTimes(2)
    fetchMock.mockRestore()
  })

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
