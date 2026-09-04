import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8")

describe("export-my-data Edge Function contract", () => {
  it("authenticates with the caller token and never uses a service-role key", () => {
    expect(source).toContain('request.headers.get("Authorization")')
    expect(source).toContain("client.auth.getUser()")
    expect(source).toContain('jsonError("unauthenticated", 401)')
    expect(source).toContain('client.rpc("export_my_data_v1")')
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY")
  })

  it("delivers a non-cacheable bounded attachment and maps throttling", () => {
    expect(source).toContain('"Cache-Control": "no-store"')
    expect(source).toContain("tharwati-data-export-v1-${day}.json")
    expect(source).toContain('jsonError("export_too_large", 413)')
    expect(source).toContain('jsonError("export_rate_limited", 429)')
    expect(source).not.toContain("console.")
  })
})
