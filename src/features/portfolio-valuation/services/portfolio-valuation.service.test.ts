import { describe, expect, it, vi } from "vitest"

import { PortfolioValuationService } from "@/features/portfolio-valuation/services/portfolio-valuation.service"
import type { HoldingDetails } from "@/features/holdings/types/holding"
import { ExchangeRateError } from "@/services/exchange-rates"
import type { CurrentExchangeRate } from "@/services/exchange-rates/types"
import { MarketDataError } from "@/services/market-data"
import type { CurrentMarketPrice } from "@/services/market-data/types"

function holding(
  overrides: Partial<HoldingDetails> = {},
): HoldingDetails {
  return {
    id: "holding-1",
    user_id: "user-1",
    account_id: "account-1",
    asset_id: "asset-1",
    quantity: "10",
    average_cost: "10.5",
    total_cost_basis: "105",
    cost_currency_code: "USD",
    notes: null,
    created_at: "2026-07-25T00:00:00.000Z",
    updated_at: "2026-07-25T00:00:00.000Z",
    asset: {
      id: "asset-1",
      name: "Test Stock",
      symbol: "TEST",
      asset_type_code: "stock",
      currency_code: "USD",
      canonical_quantity_unit: "shares",
    },
    account: {
      id: "account-1",
      name: "Brokerage",
      currency_code: "USD",
    },
    ...overrides,
  }
}

function price(
  overrides: Partial<CurrentMarketPrice> = {},
): CurrentMarketPrice {
  return {
    assetId: "asset-1",
    price: "12",
    currencyCode: "USD",
    asOf: "2026-07-25T10:00:00.000Z",
    provider: "manual",
    cachedAt: "2026-07-25T10:00:00.000Z",
    ...overrides,
  }
}

function rate(
  sourceCurrencyCode: string,
  destinationCurrencyCode: string,
  value: string,
  direction: "direct" | "inverse" = "direct",
): CurrentExchangeRate {
  return {
    sourceCurrencyCode,
    destinationCurrencyCode,
    rate: value,
    direction,
    effectiveAt: "2026-07-25T09:00:00.000Z",
    source: "manual",
    usage: "current",
    resolvedAt: "2026-07-25T10:00:00.000Z",
  }
}

function service(options: {
  prices?: Record<string, CurrentMarketPrice | null>
  rates?: Record<string, CurrentExchangeRate>
}) {
  return new PortfolioValuationService({
    prices: {
      getCurrentPrice: vi.fn(async (assetId: string) => {
        const value = options.prices?.[assetId]
        if (!value) {
          throw new MarketDataError({
            code: "market_price_unavailable",
            message: "missing",
            assetId,
          })
        }
        return value
      }),
    },
    rates: {
      resolveCurrentRate: vi.fn(async (pair) => {
        const value =
          options.rates?.[
            `${pair.sourceCurrencyCode}/${pair.destinationCurrencyCode}`
          ]
        if (!value) {
          throw new ExchangeRateError({
            code: "rate_unavailable",
            message: "missing",
            pair,
          })
        }
        return value
      }),
    },
    now: () => new Date("2026-07-25T12:00:00.000Z"),
  })
}

describe("PortfolioValuationService", () => {
  it("calculates exact market value and fee-inclusive profitable performance", async () => {
    const result = await service({
      prices: { "asset-1": price() },
    }).calculate({
      baseCurrency: "USD",
      holdings: [holding()],
    })

    expect(result.holdings[0]).toMatchObject({
      quantity: "10",
      costBasisNative: "105",
      marketValueNative: "120",
      unrealizedGainLossNative: "15",
      unrealizedReturnPercent: "14.28571429",
      marketValueBase: "120",
      unrealizedGainLossBase: "15",
    })
    expect(result).toMatchObject({
      totalMarketValueBase: "120",
      totalCostBasisBase: "105",
      totalUnrealizedGainLossBase: "15",
      valuedHoldingsCount: 1,
      completenessStatus: "complete",
    })
  })

  it("calculates an unrealized loss and leaves zero-cost return undefined", async () => {
    const result = await service({
      prices: {
        loss: price({ assetId: "loss", price: "8" }),
        zero: price({ assetId: "zero", price: "2" }),
      },
    }).calculate({
      baseCurrency: "USD",
      holdings: [
        holding({
          id: "loss",
          asset_id: "loss",
          asset: {
            ...holding().asset,
            id: "loss",
          },
        }),
        holding({
          id: "zero",
          asset_id: "zero",
          total_cost_basis: "0",
          average_cost: null,
          asset: {
            ...holding().asset,
            id: "zero",
          },
        }),
      ],
    })

    expect(result.holdings[0]?.unrealizedGainLossNative).toBe("-25")
    expect(result.holdings[1]?.unrealizedReturnPercent).toBeNull()
  })

  it("reports a missing price without substituting cost basis", async () => {
    const result = await service({}).calculate({
      baseCurrency: "USD",
      holdings: [holding()],
    })

    expect(result.holdings[0]).toMatchObject({
      marketPrice: null,
      marketValueNative: null,
      marketValueBase: null,
      missingMarketPrice: true,
    })
    expect(result.totalMarketValueBase).toBeNull()
    expect(result.completenessStatus).toBe("unavailable")
  })

  it("uses current FX for native and base reporting with exact decimals", async () => {
    const result = await service({
      prices: {
        "asset-1": price({
          price: "3.3333333333",
          currencyCode: "EUR",
        }),
      },
      rates: {
        "EUR/SAR": rate("EUR", "SAR", "4.125"),
        "USD/SAR": rate("USD", "SAR", "3.75"),
        "EUR/USD": rate("EUR", "USD", "1.1", "inverse"),
      },
    }).calculate({
      baseCurrency: "SAR",
      holdings: [holding()],
    })

    expect(result.holdings[0]).toMatchObject({
      marketPriceCurrency: "EUR",
      marketValueNative: "36.6666666663",
      costBasisBase: "393.75",
      marketValueBase: "137.499999998625",
      baseCurrency: "SAR",
    })
  })

  it("returns partial totals and every missing FX pair across mixed currencies", async () => {
    const result = await service({
      prices: {
        "asset-1": price(),
        "asset-2": price({
          assetId: "asset-2",
          currencyCode: "EUR",
        }),
      },
    }).calculate({
      baseCurrency: "USD",
      holdings: [
        holding(),
        holding({
          id: "holding-2",
          asset_id: "asset-2",
          cost_currency_code: "EUR",
          asset: {
            ...holding().asset,
            id: "asset-2",
            currency_code: "EUR",
          },
          account: {
            ...holding().account,
            id: "account-2",
            currency_code: "EUR",
          },
        }),
      ],
    })

    expect(result).toMatchObject({
      totalMarketValueBase: "120",
      totalCostBasisBase: "105",
      valuedHoldingsCount: 1,
      completenessStatus: "partial",
    })
    expect(result.missingExchangeRatePairs).toEqual([
      {
        sourceCurrencyCode: "EUR",
        destinationCurrencyCode: "USD",
      },
    ])
  })

  it("returns exact totals for multiple valued holdings", async () => {
    const result = await service({
      prices: {
        "asset-1": price({ price: "0.1000000001" }),
        "asset-2": price({
          assetId: "asset-2",
          price: "0.2000000002",
        }),
      },
    }).calculate({
      baseCurrency: "USD",
      holdings: [
        holding({
          quantity: "9007199254740993",
          total_cost_basis: "1",
        }),
        holding({
          id: "holding-2",
          asset_id: "asset-2",
          quantity: "0.0000000001",
          total_cost_basis: "0.0000000001",
          asset: { ...holding().asset, id: "asset-2" },
        }),
      ],
    })

    expect(result.totalMarketValueBase).toBe(
      "900719926374819.22547409932000000002",
    )
  })
})
