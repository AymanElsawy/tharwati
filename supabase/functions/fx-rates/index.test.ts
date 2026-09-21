import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import { getFrankfurterRate } from "../_shared/frankfurter.ts"
import { corsHeaders, json, preflightResponse } from "./http.ts"

const functionSource = readFileSync(new URL("./index.ts", import.meta.url), "utf8")

describe("fx-rates browser HTTP contract", () => {
  it("uses caller JWT for RLS and keeps the secret key in the admin client", () => {
    expect(functionSource).toContain('projectApiKey("publishable")')
    expect(functionSource).toContain('projectApiKey("secret")')
    expect(functionSource).toContain("createClient(url, publishableKey, { global: { headers: { Authorization: authorization } } })")
    expect(functionSource).toContain("createClient(url, secretKey)")
    expect(functionSource).not.toContain("SUPABASE_ANON_KEY")
    expect(functionSource).not.toContain("SUPABASE_SERVICE_ROLE_KEY")
  })
  it("answers browser preflight with 204 and the required CORS headers", () => {
    const response = preflightResponse()

    expect(response.status).toBe(204)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*")
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe(
      "POST, OPTIONS",
    )
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
      "authorization, x-client-info, apikey, content-type",
    )
    expect(corsHeaders).toMatchObject({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    })
  })

  it("routes OPTIONS before POST validation", () => {
    const optionsBranch = functionSource.indexOf(
      'if (request.method === "OPTIONS") return preflightResponse()',
    )
    const postBranch = functionSource.indexOf(
      'if (request.method !== "POST") return json',
    )

    expect(optionsBranch).toBeGreaterThan(-1)
    expect(postBranch).toBeGreaterThan(optionsBranch)
  })

  it.each([
    ["success", 200],
    ["validation error", 400],
    ["authentication error", 401],
    ["unavailable", 422],
    ["server error", 500],
  ])("adds CORS headers to every %s JSON response", async (_, status) => {
    const response = json({ status }, status)

    expect(response.status).toBe(status)
    expect(response.headers.get("Content-Type")).toBe("application/json")
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*")
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe(
      "POST, OPTIONS",
    )
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
      "authorization, x-client-info, apikey, content-type",
    )
    await expect(response.json()).resolves.toEqual({ status })
  })

  it("keeps every fx-rates JSON path on the CORS-aware response helper", () => {
    expect(functionSource).not.toContain("new Response(")
    expect(functionSource).toContain('return json(identityRate(')
    expect(functionSource).toContain("return json({ available: true")
    expect(functionSource).toContain("return json({ available: false")
    expect(functionSource).toContain('return json({ error: "authentication_required" }, 401)')
    expect(functionSource).toContain('return json({ error: "invalid_currency_or_date" }, 400)')
    expect(functionSource).toContain('return json({ error: "fx_request_failed" }, 500)')
  })
})

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
    ["AED", "USD", 0.272294],
    ["USD", "SAR", 3.75],
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

  it("finds the latest sparse AED observation on or before the requested date", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([
      { base: "AED", quote: "USD", date: "2026-08-31", rate: 0.272294 },
      { base: "AED", quote: "USD", date: "2026-09-30", rate: 0.272294 },
    ])))
    await expect(getFrankfurterRate("AED", "USD", "2026-09-19")).resolves.toEqual(
      { base: "AED", quote: "USD", date: "2026-08-31", rate: 0.272294 },
    )
    const requestedUrl = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(requestedUrl.searchParams.get("from")).toBe("2026-08-10")
    expect(requestedUrl.searchParams.get("to")).toBe("2026-09-19")
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
