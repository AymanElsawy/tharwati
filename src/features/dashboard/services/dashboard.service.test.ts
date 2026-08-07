import { describe, expect, it, vi } from "vitest"

import { DashboardService } from "@/features/dashboard/services/dashboard.service"
import type { AccountBalance } from "@/features/account-balances/types/account-balance"
import type { PortfolioValuationResult } from "@/features/portfolio-valuation/types/portfolio-valuation"
import { NetWorthService, netWorthService } from "@/features/net-worth/services/net-worth.service"
import { ExchangeRateError } from "@/services/exchange-rates"
import type { TableRow } from "@/lib/supabase/types"

const cash: AccountBalance = {
  accountId: "cash-1",
  accountTypeCode: "cash",
  accountName: "Cash",
  currencyCode: "USD",
  isActive: true,
  openingBalance: "100",
  ledgerEffect: "-20",
  currentBalance: "80",
}

const postedBuy: TableRow<"financial_transactions"> & {
  transaction_entries: []
} = {
  id: "transaction-1",
  user_id: "user-1",
  transaction_type_code: "buy",
  transaction_currency_code: "USD",
  status: "posted",
  occurred_at: "2026-07-25T10:00:00.000Z",
  description: "Buy Test",
  external_reference: null,
  notes: null,
  posted_at: "2026-07-25T10:00:01.000Z",
  created_at: "2026-07-25T10:00:00.000Z",
  updated_at: "2026-07-25T10:00:01.000Z",
  transaction_entries: [],
}

function valuation(
  overrides: Partial<PortfolioValuationResult> = {},
): PortfolioValuationResult {
  return {
    baseCurrency: "USD",
    holdings: [
      {
        holdingId: "holding-1",
        assetId: "asset-1",
        symbol: "TEST",
        assetName: "Test",
        assetType: "stock",
        quantity: "2",
        averageCost: "10",
        costBasisNative: "20",
        costBasisCurrency: "USD",
        marketPrice: "40",
        marketPriceCurrency: "USD",
        marketPriceTimestamp: "2026-07-25T09:00:00.000Z",
        marketPriceSource: "manual",
        marketValueNative: "80",
        unrealizedGainLossNative: "60",
        unrealizedReturnPercent: "300",
        marketValueBase: "80",
        costBasisBase: "20",
        unrealizedGainLossBase: "60",
        baseCurrency: "USD",
        missingMarketPrice: false,
        missingExchangeRate: [],
        stalePrice: false,
      },
    ],
    totalMarketValueBase: "80",
    totalCostBasisBase: "20",
    totalUnrealizedGainLossBase: "60",
    totalUnrealizedReturnPercent: "300",
    valuedHoldingsCount: 1,
    missingPriceHoldings: [],
    missingExchangeRatePairs: [],
    completenessStatus: "complete",
    ...overrides,
  }
}

describe("DashboardService", () => {
  it("consumes production-layer contracts for every financial widget", async () => {
    const getEligibleWealthCashBalances = vi
      .fn()
      .mockResolvedValue([cash])
    const getSource = vi.fn().mockResolvedValue({
      baseCurrency: "USD",
      holdings: [],
    })
    const calculatePortfolio = vi.fn().mockResolvedValue(valuation())
    const calculateNetWorth = vi.spyOn(netWorthService, "calculate")
    const getRecentPostedTransactions = vi
      .fn()
      .mockResolvedValue([postedBuy])
    const listRates = vi.fn().mockResolvedValue([])
    const service = new DashboardService(
      { getEligibleWealthCashBalances },
      { getSource },
      { calculate: calculatePortfolio },
      netWorthService,
      { getRecentPostedTransactions },
      { listRates },
    )

    const result = await service.load()

    expect(getEligibleWealthCashBalances).toHaveBeenCalledOnce()
    expect(getSource).toHaveBeenCalledOnce()
    expect(calculatePortfolio).toHaveBeenCalledOnce()
    expect(calculateNetWorth).toHaveBeenCalledOnce()
    expect(getRecentPostedTransactions).toHaveBeenCalledOnce()
    expect(listRates).toHaveBeenCalledOnce()
    expect(result.netWorth.netWorth).toBe("160")
    expect(result.cash.projectedBalanceBase).toBe("80")
    expect(result.investments.marketValueBase).toBe("80")
    expect(result.allocation).toEqual([
      { group: "cash", marketValue: "80", percentage: "50" },
      { group: "stocks", marketValue: "80", percentage: "50" },
    ])
    expect(result.activities[0]).toMatchObject({
      type: "buy",
      title: "Investment purchased",
    })
  })

  it("includes brokerage cash beside market value without adding cost basis", async () => {
    const brokerage: AccountBalance = {
      accountId: "brokerage-1",
      accountTypeCode: "brokerage",
      accountName: "Brokerage",
      currencyCode: "USD",
      isActive: true,
      openingBalance: "10000",
      ledgerEffect: "-4020",
      currentBalance: "5980",
    }
    const brokerageValuation = valuation({
      holdings: [
        {
          ...valuation().holdings[0],
          symbol: "NVDA",
          assetName: "NVIDIA",
          quantity: "1",
          averageCost: "4020",
          costBasisNative: "4020",
          marketPrice: "5000",
          marketValueNative: "5000",
          unrealizedGainLossNative: "980",
          unrealizedReturnPercent: "24.378109452736318408",
          marketValueBase: "5000",
          costBasisBase: "4020",
          unrealizedGainLossBase: "980",
        },
      ],
      totalMarketValueBase: "5000",
      totalCostBasisBase: "4020",
      totalUnrealizedGainLossBase: "980",
      totalUnrealizedReturnPercent: "24.378109452736318408",
    })
    const service = new DashboardService(
      {
        getEligibleWealthCashBalances: async () => [brokerage],
      },
      {
        getSource: async () => ({
          baseCurrency: "USD",
          holdings: [],
        }),
      },
      { calculate: async () => brokerageValuation },
      netWorthService,
      { getRecentPostedTransactions: async () => [] },
      { listRates: async () => [] },
    )

    const result = await service.load()

    expect(result.cash).toMatchObject({
      projectedBalanceBase: "5980",
      accountCount: 1,
    })
    expect(result.investments.marketValueBase).toBe("5000")
    expect(result.netWorth).toMatchObject({
      cashAssets: "5980",
      investmentAssets: "5000",
      totalAssets: "10980",
      netWorth: "10980",
    })
    expect(result.allocation).toEqual([
      {
        group: "cash",
        marketValue: "5980",
        percentage: "54.46265938",
      },
      {
        group: "stocks",
        marketValue: "5000",
        percentage: "45.53734062",
      },
    ])
  })

  it("loads with a valid negative brokerage cash projection", async () => {
    const negativeBrokerage: AccountBalance = {
      accountId: "brokerage-negative",
      accountTypeCode: "brokerage",
      accountName: "Brokerage",
      currencyCode: "USD",
      isActive: true,
      openingBalance: "0",
      ledgerEffect: "-4020",
      currentBalance: "-4020",
    }
    const service = new DashboardService(
      {
        getEligibleWealthCashBalances: async () => [
          negativeBrokerage,
        ],
      },
      {
        getSource: async () => ({
          baseCurrency: "USD",
          holdings: [],
        }),
      },
      {
        calculate: async () =>
          valuation({
            totalMarketValueBase: "5000",
            totalCostBasisBase: "4020",
            totalUnrealizedGainLossBase: "980",
          }),
      },
      netWorthService,
      { getRecentPostedTransactions: async () => [] },
      { listRates: async () => [] },
    )

    const result = await service.load()

    expect(result.cash.projectedBalanceBase).toBe("-4020")
    expect(result.investments.marketValueBase).toBe("5000")
    expect(result.netWorth.netWorth).toBe("980")
  })

  it("preserves partial valuation and exposes actionable missing data", async () => {
    const partial = valuation({
      holdings: [],
      totalMarketValueBase: null,
      totalCostBasisBase: "20",
      totalUnrealizedGainLossBase: null,
      totalUnrealizedReturnPercent: null,
      valuedHoldingsCount: 0,
      missingPriceHoldings: [
        {
          holdingId: "holding-1",
          assetId: "asset-1",
          assetName: "Test",
          symbol: "TEST",
        },
      ],
      missingExchangeRatePairs: [
        {
          sourceCurrencyCode: "EUR",
          destinationCurrencyCode: "USD",
        },
      ],
      completenessStatus: "unavailable",
    })
    const service = new DashboardService(
      { getEligibleWealthCashBalances: async () => [cash] },
      {
        getSource: async () => ({
          baseCurrency: "USD",
          holdings: [],
        }),
      },
      { calculate: async () => partial },
      netWorthService,
      { getRecentPostedTransactions: async () => [] },
      { listRates: async () => [] },
    )

    const result = await service.load()

    expect(result.netWorth.status).toBe("partial")
    expect(result.netWorth.netWorth).toBe("80")
    expect(result.missingData.priceHoldings).toHaveLength(1)
    expect(result.missingData.exchangeRatePairs).toEqual([
      {
        sourceCurrencyCode: "EUR",
        destinationCurrencyCode: "USD",
      },
    ])
  })

  it("clears USD/EGP from dashboard missing data when the current FX response is available", async () => {
    const fxResponse = {
      available: true,
      rate: 49.841,
      provider: "frankfurter" as const,
      effectiveAt: "2026-08-06T00:00:00Z",
      fetchedAt: "2026-08-06T12:00:00Z",
      stale: false,
      unavailable: false,
    }
    const netWorth = new NetWorthService({
      resolveCurrentRate: async (pair) => ({
        ...pair,
        rate: String(fxResponse.rate),
        direction: "direct" as const,
        effectiveAt: fxResponse.effectiveAt,
        source: fxResponse.provider,
        usage: "current" as const,
        resolvedAt: fxResponse.fetchedAt,
        fetchedAt: fxResponse.fetchedAt,
        stale: fxResponse.stale,
      }),
    })
    const service = new DashboardService(
      { getEligibleWealthCashBalances: async () => [cash] },
      { getSource: async () => ({ baseCurrency: "EGP", holdings: [] }) },
      {
        calculate: async () => valuation({
          baseCurrency: "EGP",
          missingExchangeRatePairs: [{ sourceCurrencyCode: "USD", destinationCurrencyCode: "EGP" }],
          fxRates: [{ sourceCurrencyCode: "USD", destinationCurrencyCode: "EGP", provider: fxResponse.provider, effectiveAt: fxResponse.effectiveAt, fetchedAt: fxResponse.fetchedAt, stale: false }],
        }),
      },
      netWorth,
      { getRecentPostedTransactions: async () => [] },
      { listRates: async () => [] },
    )

    await expect(service.load()).resolves.toMatchObject({
      missingData: { exchangeRatePairs: [] },
    })
  })

  it("keeps USD/EGP in dashboard missing data when current FX is unavailable", async () => {
    const netWorth = new NetWorthService({
      resolveCurrentRate: async (pair) => {
        throw new ExchangeRateError({ code: "rate_unavailable", message: "unavailable", pair })
      },
    })
    const service = new DashboardService(
      { getEligibleWealthCashBalances: async () => [cash] },
      { getSource: async () => ({ baseCurrency: "EGP", holdings: [] }) },
      {
        calculate: async () => valuation({
          baseCurrency: "EGP",
          missingExchangeRatePairs: [{ sourceCurrencyCode: "USD", destinationCurrencyCode: "EGP" }],
        }),
      },
      netWorth,
      { getRecentPostedTransactions: async () => [] },
      { listRates: async () => [] },
    )

    await expect(service.load()).resolves.toMatchObject({
      missingData: {
        exchangeRatePairs: [{ sourceCurrencyCode: "USD", destinationCurrencyCode: "EGP" }],
      },
    })
  })
})
