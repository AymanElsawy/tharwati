import { describe, expect, it } from "vitest"

import { getProfileCurrencyDefault } from "./currency-default"

describe("getProfileCurrencyDefault", () => {
  it("uses the profile base currency for new form defaults", () => {
    expect(getProfileCurrencyDefault("SAR")).toBe("SAR")
    expect(getProfileCurrencyDefault(" egp ")).toBe("EGP")
  })

  it("falls back to USD only when the profile currency is unavailable or unsupported", () => {
    expect(getProfileCurrencyDefault(null)).toBe("USD")
    expect(getProfileCurrencyDefault("JPY")).toBe("USD")
  })
})
