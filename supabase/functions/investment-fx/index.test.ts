import { describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { getFrankfurterRate } from "../_shared/frankfurter.ts"

const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8")

describe("investment-fx Frankfurter provider", () => {
  it("keeps investment reads and RPCs caller-scoped and shared FX cache privileged", () => {
    expect(source).toContain('projectApiKey("publishable"), { global: { headers: { Authorization: authorization } } }')
    expect(source).toContain("userClient.auth.getUser()")
    expect(source).toContain('userClient.rpc("add_investment", args)')
    expect(source).toContain('userClient.rpc("edit_investment", args)')
    expect(source).toContain('createClient(Deno.env.get("SUPABASE_URL")!, projectApiKey("secret"))')
    expect(source).toContain('admin.from("exchange_rates")')
    expect(source).not.toContain("SUPABASE_ANON_KEY")
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY")
  })

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
