import { describe, expect, it } from "vitest"
import { getDefaultCurrencyCode } from "./country-currency"
import { supportedCurrencies } from "./currencies"

describe("AED onboarding support", () => {
  it("preselects AED for UAE and exposes it as supported", () => {
    expect(getDefaultCurrencyCode("AE")).toBe("AED")
    expect(supportedCurrencies.find(({ code }) => code === "AED")).toMatchObject({ code: "AED", name: "United Arab Emirates Dirham" })
  })

  it("retains every existing supported currency", () => {
    expect(supportedCurrencies.map(({ code }) => code)).toEqual(expect.arrayContaining(["USD", "SAR", "EGP", "EUR", "GBP", "AED"]))
  })
})
