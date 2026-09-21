import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8")

describe("market-prices key and auth contract", () => {
  it("uses caller JWT for owned asset reads and the runtime secret for shared cache access", () => {
    expect(source).toContain('projectApiKey("publishable")')
    expect(source).toContain('projectApiKey("secret")')
    expect(source).toContain("createClient(url, publishableKey, { global: { headers: { Authorization: authorization } } })")
    expect(source).toContain("createClient(url, secretKey)")
    expect(source).not.toContain("SUPABASE_ANON_KEY")
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY")
  })
})
