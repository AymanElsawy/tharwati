import { describe, expect, it, vi } from "vitest"

import type { AccountBalance } from "@/features/account-balances/types/account-balance"
import type { HoldingDetails } from "@/features/holdings/types/holding"
import { PortfolioExecutiveService } from "@/features/portfolio/services/portfolio-executive.service"
import type {
  HoldingValuationResult,
  PortfolioValuationResult,
  PortfolioValuationSource,
} from "@/features/portfolio-valuation/types/portfolio-valuation"

function sourceHolding(
  id: string,
  accountId: string,
  accountName: string,
): HoldingDetails {
  return {
    id,
    user_id: "user-a",
    account_id: accountId,
    asset_id: `asset-${id}`,
    quantity: "1",
    average_cost: "100",
    total_cost_basis: "100",
    cost_currency_code: "SAR",
    notes: null,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    asset: {
      id: `asset-${id}`,
      name: `Asset ${id}`,
      symbol: id.toUpperCase(),
      asset_type_code: id === "one" ? "stock" : "etf",
      currency_code: "SAR",
      canonical_quantity_unit: "shares",
    },
    account: {
      id: accountId,
      name: accountName,
      currency_code: "SAR",
    },
  }
}

function valuedHolding(
  holding: HoldingDetails,
  marketValue: string,
): HoldingValuationResult {
  return {
    holdingId: holding.id,
    assetId: holding.asset.id,
    symbol: holding.asset.symbol,
    assetName: holding.asset.name,
    assetType: holding.asset.asset_type_code,
    quantity: holding.quantity,
    averageCost: holding.average_cost,
    costBasisNative: holding.total_cost_basis,
    costBasisCurrency: "SAR",
    marketPrice: marketValue,
    marketPriceCurrency: "SAR",
    marketPriceTimestamp: "2026-07-26T12:00:00Z",
    marketPriceSource: "manual",
    marketValueNative: marketValue,
    unrealizedGainLossNative: "0",
    unrealizedReturnPercent: "0",
    marketValueBase: marketValue,
    costBasisBase: holding.total_cost_basis,
    unrealizedGainLossBase: "0",
    baseCurrency: "SAR",
    missingMarketPrice: false,
    missingExchangeRate: [],
    stalePrice: false,
  }
}

function valuation(
  source: PortfolioValuationSource,
): PortfolioValuationResult {
  const holdings = source.holdings.map((holding, index) =>
    valuedHolding(holding, index === 0 ? "600" : "400"),
  )
  return {
    baseCurrency: "SAR",
    holdings,
    totalMarketValueBase:
      holdings.length === 0
        ? "0"
        : holdings.length === 1
          ? holdings[0].marketValueBase
          : "1000",
    totalCostBasisBase:
      holdings.length === 0 ? "0" : `${holdings.length * 100}`,
    totalUnrealizedGainLossBase: "0",
    totalUnrealizedReturnPercent: "0",
    valuedHoldingsCount: holdings.length,
    missingPriceHoldings: [],
    missingExchangeRatePairs: [],
    completenessStatus: "complete",
  }
}

describe("PortfolioExecutiveService", () => {
  it("builds one synchronized executive summary from scoped portfolio data", async () => {
    const holdings = [
      sourceHolding("one", "account-a", "Brokerage A"),
      sourceHolding("two", "account-b", "Brokerage B"),
    ]
    const repository = {
      getSource: vi.fn(async () => ({
        baseCurrency: "SAR",
        holdings,
      })),
    }
    const calculator = {
      calculate: vi.fn(async (input: PortfolioValuationSource) =>
        valuation(input),
      ),
    }
    const balances: AccountBalance[] = [
      {
        accountId: "account-a",
        accountTypeCode: "brokerage",
        accountName: "Brokerage A",
        currencyCode: "SAR",
        isActive: true,
        openingBalance: "1000",
        ledgerEffect: "-800",
        currentBalance: "200",
      },
      {
        accountId: "account-b",
        accountTypeCode: "brokerage",
        accountName: "Brokerage B",
        currencyCode: "SAR",
        isActive: true,
        openingBalance: "500",
        ledgerEffect: "0",
        currentBalance: "500",
      },
    ]
    const balanceReader = {
      getEligibleWealthCashBalances: vi.fn(async () => balances),
    }
    const netWorth = {
      calculate: vi.fn(async ({ accounts }) => ({
        cashAssets:
          accounts.length === 1 ? accounts[0].balance : "700",
      })),
    }
    const service = new PortfolioExecutiveService(
      repository,
      calculator,
      balanceReader,
      netWorth,
      { getRecentPostedTransactions: async () => [] },
    )

    const result = await service.load("account-a")

    expect(calculator.calculate).toHaveBeenCalledWith({
      baseCurrency: "SAR",
      holdings: [holdings[0]],
    })
    expect(netWorth.calculate).toHaveBeenCalledWith(
      expect.objectContaining({
        accounts: [
          {
            accountId: "account-a",
            balance: "200",
            currencyCode: "SAR",
          },
        ],
      }),
    )
    expect(result.activeScopeId).toBe("account-a")
    expect(result.value.openHoldingsCount).toBe(1)
    expect(result.scopeOptions.map((scope) => scope.id)).toEqual([
      "account-a",
      "account-b",
    ])
    expect(result.health.score).not.toBeNull()
  })

  it("returns explicit empty executive states without inventing values", async () => {
    const service = new PortfolioExecutiveService(
      {
        getSource: async () => ({ baseCurrency: "SAR", holdings: [] }),
      },
      {
        calculate: async (input: PortfolioValuationSource) =>
          valuation(input),
      },
      { getEligibleWealthCashBalances: async () => [] },
      { calculate: async () => ({ cashAssets: "0" }) },
      { getRecentPostedTransactions: async () => [] },
    )

    const result = await service.load()

    expect(result.isEmpty).toBe(true)
    expect(result.health.score).toBeNull()
    expect(result.insights).toEqual([])
  })
})
