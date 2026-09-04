import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8")

describe("delete-account Edge Function contract", () => {
  it("is bounded, caller-derived, reauthenticated, and deletes only caller", () => {
    expect(source).toContain('request.method !== "POST"')
    expect(source).toContain("maximumBodyBytes = 4096")
    expect(source).toContain("callerClient.auth.getUser()")
    expect(source).toContain("signInWithPassword({ email: caller.email, password })")
    expect(source).toContain("reauthenticated.user?.id !== caller.id")
    expect(source).toContain("deleteUser(caller.id, false)")
    expect(source).not.toMatch(/parsed\.(user_?id|email)/i)
  })

  it("returns stable errors and no-store empty success without logging", () => {
    expect(source).toContain("status: 204")
    expect(source).toContain('"Cache-Control": "no-store"')
    expect(source).not.toContain("console.")
    for (const code of ["unauthenticated", "reauthentication_failed", "deletion_failed", "method_not_allowed"]) expect(source).toContain(`"${code}"`)
  })
})
