import { describe, expect, it } from "vitest"

import { getMissingRateLinkState } from "@/features/net-worth/utils/missing-rate-link"

describe("getMissingRateLinkState", () => {
  it("prefills the exact missing pair for the exchange-rate page", () => {
    expect(
      getMissingRateLinkState({
        status: "partial",
        totalAssets: "0",
        cashAssets: "0",
        investmentAssets: "0",
        totalLiabilities: "0",
        netWorth: "0",
        accountCount: 1,
        investmentHoldingCount: 0,
        baseCurrency: "SAR",
        missingPriceHoldings: [],
        missingCurrencyPairs: [
          { sourceCurrencyCode: "USD", destinationCurrencyCode: "SAR" },
        ],
      }),
    ).toEqual({
      sourceCurrencyCode: "USD",
      destinationCurrencyCode: "SAR",
    })
  })
})
