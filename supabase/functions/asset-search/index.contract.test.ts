import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8")

describe("asset-search authentication contract", () => {
  it("uses the publishable key with the caller JWT and keeps the provider key separate", () => {
    expect(source).toContain('request.headers.get("Authorization")')
    expect(source).toContain('createClient(url, projectApiKey("publishable"), {')
    expect(source).toContain("global: { headers: { Authorization: authorization } }")
    expect(source).toContain("userClient.auth.getUser()")
    expect(source).toContain('Deno.env.get("TWELVE_DATA_API_KEY")')
    expect(source).not.toContain("SUPABASE_ANON_KEY")
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY")
  })
})
