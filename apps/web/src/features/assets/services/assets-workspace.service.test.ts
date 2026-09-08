import { describe, expect, it } from "vitest"

import { AssetsWorkspaceService } from "@/features/assets/services/assets-workspace.service"
import type { HoldingDetails } from "@/features/holdings/types/holding"
import type {
  HoldingValuationResult,
  PortfolioValuationResult,
} from "@/features/portfolio-valuation/types/portfolio-valuation"
import type { AssetSummary } from "@/lib/supabase/types"
import type { AssetActivityEvidence, AssetRelationshipEvidence } from "@/features/assets/types/asset-workspace"

function asset(id: string, custom = false): AssetSummary {
  return {
    id,
    user_id: custom ? "user-a" : null,
    asset_type_code: id === "gold" ? "commodity" : "stock",
    symbol: id.toUpperCase(),
    name: id,
    currency_code: "USD",
    exchange: "XNAS",
    is_custom: custom,
    is_active: true,
    canonical_quantity_unit: "shares",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  }
}

function holding(assetRow: AssetSummary): HoldingDetails {
  return {
    id: `holding-${assetRow.id}`,
    user_id: "user-a",
    account_id: "account-a",
    asset_id: assetRow.id,
    quantity: "1",
    average_cost: "100",
    total_cost_basis: "100",
    cost_currency_code: "USD",
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    asset: {
      id: assetRow.id,
      name: assetRow.name,
      symbol: assetRow.symbol,
      asset_type_code: assetRow.asset_type_code,
      currency_code: assetRow.currency_code,
      canonical_quantity_unit: assetRow.canonical_quantity_unit,
    },
    account: {
      id: "account-a",
      name: "Brokerage",
      currency_code: "USD",
    },
  }
}

function valuation(
  holdingRow: HoldingDetails,
  missingPrice = false,
): PortfolioValuationResult {
  const result: HoldingValuationResult = {
    holdingId: holdingRow.id,
    assetId: holdingRow.asset.id,
    symbol: holdingRow.asset.symbol,
    assetName: holdingRow.asset.name,
    assetType: holdingRow.asset.asset_type_code,
    quantity: "1",
    averageCost: "100",
    costBasisNative: "100",
    costBasisCurrency: "USD",
    marketPrice: missingPrice ? null : "110",
    marketPriceCurrency: missingPrice ? null : "USD",
    marketPriceTimestamp: missingPrice ? null : "2026-07-27T00:00:00Z",
    marketPriceSource: missingPrice ? null : "manual",
    marketValueNative: missingPrice ? null : "110",
    unrealizedGainLossNative: missingPrice ? null : "10",
    unrealizedReturnPercent: missingPrice ? null : "10",
    marketValueBase: missingPrice ? null : "110",
    costBasisBase: "100",
    unrealizedGainLossBase: missingPrice ? null : "10",
    baseCurrency: "USD",
    missingMarketPrice: missingPrice,
    missingExchangeRate: [],
    stalePrice: missingPrice ? null : false,
  }
  return {
    baseCurrency: "USD",
    holdings: [result],
    totalMarketValueBase: result.marketValueBase,
    totalCostBasisBase: "100",
    totalUnrealizedGainLossBase: result.unrealizedGainLossBase,
    totalUnrealizedReturnPercent: result.unrealizedReturnPercent,
    valuedHoldingsCount: missingPrice ? 0 : 1,
    missingPriceHoldings: missingPrice
      ? [{ holdingId: result.holdingId, assetId: result.assetId, assetName: result.assetName, symbol: result.symbol }]
      : [],
    missingExchangeRatePairs: [],
    completenessStatus: missingPrice ? "unavailable" : "complete",
  }
}

describe("AssetsWorkspaceService", () => {
  it("distinguishes explicit ownership from record-only catalog entries", async () => {
    const owned = asset("nvidia")
    const record = asset("gold", true)
    const ownedHolding = holding(owned)
    const service = new AssetsWorkspaceService(
      {
        getAssets: async () => [owned, record],
        getAssetReferenceCounts: async () => [],
      },
      { getSource: async () => ({ baseCurrency: "USD", holdings: [ownedHolding] }) },
      { calculate: async () => valuation(ownedHolding) },
      { getRecentPostedTransactions: async () => [] },
      { getAccounts: async () => [] },
    )
    const result = await service.load(null)
    expect(result.items.map((item) => [item.asset.id, item.ownership])).toEqual([
      ["nvidia", "owned"],
      ["gold", "record_only"],
    ])
    expect(result.items[1].dataStatus).toBe("not_applicable")
  })

  it("surfaces missing valuation data without substituting record values", async () => {
    const owned = asset("nvidia")
    const ownedHolding = holding(owned)
    const service = new AssetsWorkspaceService(
      {
        getAssets: async () => [owned],
        getAssetReferenceCounts: async () => [],
      },
      { getSource: async () => ({ baseCurrency: "USD", holdings: [ownedHolding] }) },
      { calculate: async () => valuation(ownedHolding, true) },
      { getRecentPostedTransactions: async () => [] },
      { getAccounts: async () => [] },
    )
    const result = await service.load(null)
    expect(result.items[0]).toMatchObject({
      ownership: "owned",
      currentPrice: null,
      dataStatus: "missing_price",
    })
    expect(result.issueCount).toBe(1)
  })

  it("applies local filters and stable sorting deterministically", () => {
    const service = new AssetsWorkspaceService()
    const first = asset("alpha")
    const second = asset("beta", true)
    const items = [first, second].map((assetRow, index) => ({
      asset: assetRow,
      ownership: index === 0 ? "owned" as const : "record_only" as const,
      lifecycle: "active" as const,
      origin: assetRow.is_custom ? "custom" as const : "global" as const,
      accounts: index === 0 ? [{ id: "account-a", name: "Brokerage" }] : [],
      holdingCount: index === 0 ? 1 : 0,
      currentPrice: null,
      priceCurrency: null,
      priceTimestamp: null,
      dataStatus: index === 0 ? "missing_price" as const : "not_applicable" as const,
      classificationComplete: true,
      valuationSupported: true,
      valuationReady: false,
      fxRequired: false,
      fxCovered: false,
      missingExchangeRatePairs: [],
      referenceCount: 0,
    }))
    const result = service.filterAndSort(items, null, {
      search: "brokerage",
      ownership: "owned",
      accountId: "account-a",
      currency: "USD",
      lifecycle: "active",
      origin: "global",
      sort: "name",
      direction: "desc",
    })
    expect(result.map((item) => item.asset.id)).toEqual(["alpha"])
  })

  it("calculates transparent deterministic health factors and issues", () => {
    const service = new AssetsWorkspaceService()
    const base = asset("alpha")
    const items = [
      {
        asset: base,
        ownership: "owned" as const,
        lifecycle: "active" as const,
        origin: "global" as const,
        accounts: [],
        holdingCount: 1,
        currentPrice: null,
        priceCurrency: null,
        priceTimestamp: null,
        dataStatus: "missing_price" as const,
        classificationComplete: true,
        valuationSupported: true,
        valuationReady: false,
        fxRequired: false,
        fxCovered: false,
        missingExchangeRatePairs: [],
        referenceCount: 1,
      },
    ]
    const analysis = service.analyze(items)
    expect(analysis.factors.find((factor) => factor.id === "price_coverage")).toMatchObject({
      numerator: 0,
      denominator: 1,
      score: 0,
      status: "attention",
    })
    expect(analysis.issues.map((issue) => issue.id)).toEqual(["missing_price"])
    expect(analysis.provisional).toBe(true)
  })

  it("maps synchronized health and issue selections to the same evidence", () => {
    const service = new AssetsWorkspaceService()
    const item = {
      asset: asset("alpha"),
      ownership: "owned" as const,
      lifecycle: "active" as const,
      origin: "global" as const,
      accounts: [],
      holdingCount: 1,
      currentPrice: null,
      priceCurrency: null,
      priceTimestamp: null,
      dataStatus: "missing_price" as const,
      classificationComplete: true,
      valuationSupported: true,
      valuationReady: false,
      fxRequired: false,
      fxCovered: false,
      missingExchangeRatePairs: [],
      referenceCount: 0,
    }
    const analysis = service.analyze([item])
    expect(service.issueForFactor("price_coverage", analysis)).toBe("missing_price")
    expect(service.factorForIssue("missing_price")).toBe("price_coverage")
    expect(
      service.filterByAnalysis([item], analysis, "price_coverage", "missing_price"),
    ).toEqual([item])
  })

  it("filters explicit relationships without aggregating currencies or precision", () => {
    const service = new AssetsWorkspaceService()
    const relationships: AssetRelationshipEvidence[] = [
      { holdingId: "h-usd", assetId: "asset-a", accountId: "account-a", accountName: "USD Broker", quantity: "9007199254740993.0000000001", unit: "shares", averageCost: "1.20", totalCostBasis: "10808639105689191.6000000001", costCurrency: "USD", marketValueBase: null, baseCurrency: "SAR", dataStatus: "missing_fx", relatedActivityCount: 1 },
      { holdingId: "h-sar", assetId: "asset-a", accountId: "account-b", accountName: "SAR Broker", quantity: "0.0000000001", unit: "shares", averageCost: "2", totalCostBasis: "2", costCurrency: "SAR", marketValueBase: "2", baseCurrency: "SAR", dataStatus: "complete", relatedActivityCount: 1 },
    ]
    const result = service.filterRelationships(relationships, new Set(["asset-a"]), "asset-a", null)
    expect(result).toEqual(relationships)
    expect(result.map((item) => item.costCurrency)).toEqual(["USD", "SAR"])
    expect(result[0].quantity).toBe("9007199254740993.0000000001")
  })

  it("synchronizes posted asset activity by selected asset and account", () => {
    const service = new AssetsWorkspaceService()
    const activity: AssetActivityEvidence[] = [
      { id: "tx-a", type: "buy", description: "Buy A", occurredAt: "2026-01-01", postedAt: "2026-01-01", originalCurrency: "USD", originalAmount: "10.0000000001", assetIds: ["asset-a"], accountIds: ["account-a"], entries: [] },
      { id: "tx-b", type: "buy", description: "Buy B", occurredAt: "2026-01-02", postedAt: "2026-01-02", originalCurrency: "SAR", originalAmount: "20", assetIds: ["asset-b"], accountIds: ["account-b"], entries: [] },
    ]
    expect(service.filterActivity(activity, new Set(["asset-a", "asset-b"]), "asset-a", { relationshipAccountId: null, activityAccountId: "account-a", activityType: "buy" })).toEqual([activity[0]])
  })
})
