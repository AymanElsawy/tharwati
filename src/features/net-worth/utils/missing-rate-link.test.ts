import { describe, expect, it } from "vitest"

import { getMissingRateLinkState } from "@/features/net-worth/utils/missing-rate-link"

describe("getMissingRateLinkState", () => {
  it("prefills the exact missing pair for the exchange-rate page", () => {
    expect(
      getMissingRateLinkState({
        status: "incomplete",
        totalAssets: null,
        totalLiabilities: "0",
        netWorth: null,
        accountCount: 1,
        baseCurrency: "SAR",
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
