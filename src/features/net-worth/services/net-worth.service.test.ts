import { describe, expect, it } from "vitest"

import { NetWorthService } from "@/features/net-worth/services/net-worth.service"
import { ExchangeRateError } from "@/services/exchange-rates"

function rates(values: Record<string, string>) {
  return {
    async resolveCurrentRate(pair: {
      sourceCurrencyCode: string
      destinationCurrencyCode: string
    }) {
      const key = `${pair.sourceCurrencyCode}/${pair.destinationCurrencyCode}`
      const rate = values[key]
      if (!rate) {
        throw new ExchangeRateError({
          code: "rate_unavailable",
          message: `Missing ${key}`,
          pair,
        })
      }
      return { rate }
    },
  }
}

describe("NetWorthService", () => {
  it("calculates one base-currency account without resolving FX", async () => {
    const service = new NetWorthService(rates({}))
    await expect(
      service.calculate({
        baseCurrency: "SAR",
        accounts: [{ accountId: "1", balance: "125400", currencyCode: "SAR" }],
      }),
    ).resolves.toMatchObject({
      status: "success",
      totalAssets: "125400",
      netWorth: "125400",
      accountCount: 1,
    })
  })

  it("converts and sums multiple account currencies", async () => {
    const service = new NetWorthService(rates({ "USD/SAR": "3.75" }))
    const result = await service.calculate({
      baseCurrency: "SAR",
      accounts: [
        { accountId: "1", balance: "100", currencyCode: "USD" },
        { accountId: "2", balance: "25", currencyCode: "SAR" },
      ],
    })
    expect(result).toMatchObject({ totalAssets: "400", netWorth: "400" })
  })

  it("returns missing FX as incomplete data", async () => {
    const service = new NetWorthService(rates({}))
    await expect(
      service.calculate({
        baseCurrency: "SAR",
        accounts: [{ accountId: "1", balance: "100", currencyCode: "USD" }],
      }),
    ).resolves.toMatchObject({
      status: "incomplete",
      totalAssets: null,
      netWorth: null,
      missingCurrencyPairs: [
        { sourceCurrencyCode: "USD", destinationCurrencyCode: "SAR" },
      ],
    })
  })

  it("returns a zero-valued empty portfolio", async () => {
    const service = new NetWorthService(rates({}))
    await expect(
      service.calculate({ baseCurrency: "SAR", accounts: [] }),
    ).resolves.toEqual({
      status: "empty",
      totalAssets: "0",
      totalLiabilities: "0",
      netWorth: "0",
      accountCount: 0,
      baseCurrency: "SAR",
      missingCurrencyPairs: [],
    })
  })

  it("calculates net worth as assets minus liabilities", async () => {
    const service = new NetWorthService(rates({}))
    const result = await service.calculate({
      baseCurrency: "USD",
      accounts: [{ accountId: "1", balance: "50", currencyCode: "USD" }],
    })
    expect(result).toMatchObject({
      totalAssets: "50",
      totalLiabilities: "0",
      netWorth: "50",
    })
  })
})
