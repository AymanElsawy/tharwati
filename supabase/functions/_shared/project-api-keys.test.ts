import { describe, expect, it } from "vitest"
import { defaultProjectApiKey } from "./project-api-keys.ts"

describe("Edge runtime project keys", () => {
  it("selects only the default publishable or secret key", () => {
    expect(defaultProjectApiKey(JSON.stringify({ default: "sb_publishable_example" }), "publishable"))
      .toBe("sb_publishable_example")
    expect(defaultProjectApiKey(JSON.stringify({ default: "sb_secret_example" }), "secret"))
      .toBe("sb_secret_example")
  })

  it("rejects missing, malformed, and wrong-privilege keys without exposing values", () => {
    expect(() => defaultProjectApiKey(undefined, "publishable")).toThrow("unavailable")
    expect(() => defaultProjectApiKey("", "secret")).toThrow("unavailable")
    expect(() => defaultProjectApiKey("[]", "publishable")).toThrow("no default key")
    expect(() => defaultProjectApiKey("{}", "secret")).toThrow("no default key")
    expect(() => defaultProjectApiKey(JSON.stringify({ default: "legacy-key" }), "publishable"))
      .toThrow("no default key")
    expect(() => defaultProjectApiKey(JSON.stringify({ default: "sb_secret_example" }), "publishable"))
      .toThrow("no default key")
    expect(() => defaultProjectApiKey(JSON.stringify({ default: "sb_publishable_example" }), "secret"))
      .toThrow("no default key")
  })
})
