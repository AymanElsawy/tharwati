import { describe, expect, it } from "vitest"

import { NetWorthService } from "@/features/net-worth/services/net-worth.service"
import { ExchangeRateError } from "@/services/exchange-rates"
import type { PortfolioValuationResult } from "@/features/portfolio-valuation/types/portfolio-valuation"

function portfolio(
  overrides: Partial<PortfolioValuationResult> = {},
): PortfolioValuationResult {
  return {
    baseCurrency: "SAR",
    holdings: [],
    totalMarketValueBase: "20100",
    totalCostBasisBase: "20100",
    totalUnrealizedGainLossBase: "0",
    totalUnrealizedReturnPercent: "0",
    valuedHoldingsCount: 1,
    missingPriceHoldings: [],
    missingExchangeRatePairs: [],
    completenessStatus: "complete",
    ...overrides,
  }
}

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

  it("returns missing FX as partial data without hiding the known amount", async () => {
    const service = new NetWorthService(rates({}))
    await expect(
      service.calculate({
        baseCurrency: "SAR",
        accounts: [{ accountId: "1", balance: "100", currencyCode: "USD" }],
      }),
    ).resolves.toMatchObject({
      status: "partial",
      totalAssets: "0",
      cashAssets: "0",
      investmentAssets: "0",
      netWorth: "0",
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
      cashAssets: "0",
      investmentAssets: "0",
      totalLiabilities: "0",
      netWorth: "0",
      accountCount: 0,
      baseCurrency: "SAR",
      missingCurrencyPairs: [],
      missingPriceHoldings: [],
      investmentHoldingCount: 0,
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

  it("adds portfolio market value to projected cash without double counting the purchase", async () => {
    const service = new NetWorthService(rates({}))
    const result = await service.calculate({
      baseCurrency: "SAR",
      accounts: [
        {
          accountId: "cash",
          balance: "79900",
          currencyCode: "SAR",
        },
      ],
      portfolio: portfolio(),
    })

    expect(result).toMatchObject({
      totalAssets: "100000",
      netWorth: "100000",
      accountCount: 1,
      investmentHoldingCount: 1,
    })
  })

  it("includes remaining brokerage cash and holding market value exactly once", async () => {
    const service = new NetWorthService(rates({}))
    const result = await service.calculate({
      baseCurrency: "USD",
      accounts: [
        {
          accountId: "brokerage",
          balance: "5980",
          currencyCode: "USD",
        },
      ],
      portfolio: portfolio({
        baseCurrency: "USD",
        totalMarketValueBase: "5000",
        totalCostBasisBase: "4020",
        totalUnrealizedGainLossBase: "980",
      }),
    })

    expect(result).toMatchObject({
      status: "success",
      cashAssets: "5980",
      investmentAssets: "5000",
      totalAssets: "10980",
      netWorth: "10980",
      accountCount: 1,
      investmentHoldingCount: 1,
    })
  })

  it("accepts an exact negative brokerage cash projection", async () => {
    const service = new NetWorthService(rates({}))
    const result = await service.calculate({
      baseCurrency: "USD",
      accounts: [
        {
          accountId: "brokerage",
          balance: "-4020",
          currencyCode: "USD",
        },
      ],
      portfolio: portfolio({
        baseCurrency: "USD",
        totalMarketValueBase: "5000",
        totalCostBasisBase: "4020",
        totalUnrealizedGainLossBase: "980",
      }),
    })

    expect(result).toMatchObject({
      status: "success",
      cashAssets: "-4020",
      investmentAssets: "5000",
      totalAssets: "980",
      netWorth: "980",
    })
  })

  it("continues to reject malformed projected balances", async () => {
    const service = new NetWorthService(rates({}))

    await expect(
      service.calculate({
        baseCurrency: "USD",
        accounts: [
          {
            accountId: "brokerage",
            balance: "not-a-decimal",
            currencyCode: "USD",
          },
        ],
      }),
    ).rejects.toThrow("Cash account brokerage has an invalid balance")
  })

  it("returns known cash and investment value when portfolio valuation is partial", async () => {
    const service = new NetWorthService(rates({}))
    const result = await service.calculate({
      baseCurrency: "SAR",
      accounts: [
        {
          accountId: "cash",
          balance: "1000",
          currencyCode: "SAR",
        },
      ],
      portfolio: portfolio({
        totalMarketValueBase: "500",
        completenessStatus: "partial",
        missingPriceHoldings: [
          {
            holdingId: "missing",
            assetId: "asset-missing",
            assetName: "Missing",
            symbol: "MISS",
          },
        ],
      }),
    })

    expect(result).toMatchObject({
      status: "partial",
      totalAssets: "1500",
      investmentAssets: "500",
      netWorth: "1500",
      missingPriceHoldings: [{ holdingId: "missing" }],
    })
  })

  it("does not substitute holding cost basis when a market price is missing", async () => {
    const service = new NetWorthService(rates({}))
    const result = await service.calculate({
      baseCurrency: "USD",
      accounts: [
        {
          accountId: "brokerage",
          balance: "5980",
          currencyCode: "USD",
        },
      ],
      portfolio: portfolio({
        baseCurrency: "USD",
        holdings: [],
        totalMarketValueBase: null,
        totalCostBasisBase: "4020",
        totalUnrealizedGainLossBase: null,
        totalUnrealizedReturnPercent: null,
        valuedHoldingsCount: 0,
        completenessStatus: "unavailable",
        missingPriceHoldings: [
          {
            holdingId: "holding-nvda",
            assetId: "asset-nvda",
            assetName: "NVIDIA",
            symbol: "NVDA",
          },
        ],
      }),
    })

    expect(result).toMatchObject({
      status: "partial",
      cashAssets: "5980",
      investmentAssets: "0",
      totalAssets: "5980",
      netWorth: "5980",
    })
  })
})
