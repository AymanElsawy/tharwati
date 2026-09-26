import { describe, expect, it } from "vitest"
import { formatMoneyInput, isPositiveMoneyInput, normalizeMoneyInput } from "./money-input"

describe("money input", () => {
  it.each([
    ["1000", "1000", "1,000"],
    ["1,000", "1000", "1,000"],
    ["1000.5", "1000.5", "1,000.5"],
    ["1000.50", "1000.50", "1,000.50"],
    ["1,000.50", "1000.50", "1,000.50"],
    ["123456789012345678.90", "123456789012345678.90", "123,456,789,012,345,678.90"],
  ])("keeps %s as exact decimal text", (input, canonical, display) => {
    expect(normalizeMoneyInput(input)).toBe(canonical)
    expect(formatMoneyInput(canonical)).toBe(display)
  })

  it.each(["1,00", "12,34", "1,00,000", "1000,000", "1,,000", "1,000.123", "1000.123", "-1", "0.001", "1e3"])(
    "rejects malformed or excessive precision %s", (input) => {
      expect(normalizeMoneyInput(input)).toBeNull()
    }
  )

  it("rejects zero without floating point conversion", () => {
    expect(isPositiveMoneyInput("0.00")).toBe(false)
    expect(isPositiveMoneyInput("1,000.00")).toBe(true)
  })
})
