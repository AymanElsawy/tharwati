import { describe, expect, it } from "vitest"

import { isFrankfurterSupportedPair } from "@/services/exchange-rates/frankfurter-supported"

describe("isFrankfurterSupportedPair", () => {
  it("recognizes USD/EGP as automatically supported", () => {
    expect(isFrankfurterSupportedPair("USD", "EGP")).toBe(true)
  })

  it("does not classify an unsupported code as automatically supported", () => {
    expect(isFrankfurterSupportedPair("USD", "XYZ")).toBe(false)
  })
})
