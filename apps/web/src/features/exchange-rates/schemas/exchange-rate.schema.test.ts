import { describe, expect, it } from "vitest"

import { exchangeRateSchema } from "@/features/exchange-rates/schemas/exchange-rate.schema"

const validRate = {
  fromCurrencyCode: "USD",
  toCurrencyCode: "SAR",
  rate: "3.75",
  effectiveAt: "2026-07-25T12:00",
}

describe("exchangeRateSchema", () => {
  it("accepts a valid exact decimal rate", () => {
    expect(exchangeRateSchema.safeParse(validRate).success).toBe(true)
  })

  it("rejects identical currencies", () => {
    expect(
      exchangeRateSchema.safeParse({ ...validRate, toCurrencyCode: "USD" }).success,
    ).toBe(false)
  })

  it.each(["0", "0.000", "-1"])("rejects non-positive rate %s", (rate) => {
    expect(exchangeRateSchema.safeParse({ ...validRate, rate }).success).toBe(false)
  })
})
