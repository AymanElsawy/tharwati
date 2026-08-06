import type { AssetSummary, Decimal, QuantityUnit } from "@/lib/supabase/types"

export type AssetOwnershipState = "owned" | "record_only"
export type AssetLifecycleState = "active" | "archived"
export type AssetOrigin = "global" | "custom"
export type AssetDataStatus =
  | "complete"
  | "missing_price"
  | "missing_fx"
  | "stale"
  | "not_applicable"
  | "unsupported"
  | "missing_classification"
  | "missing_valuation_date"

export type AssetHealthFactorId =
  | "price_coverage"
  | "fx_coverage"
  | "classification_completeness"
  | "valuation_readiness"
  | "archived_references"

export type AssetQualityIssueId =
  | "missing_price"
  | "missing_fx"
  | "missing_classification"
  | "missing_valuation_date"
  | "unsupported_valuation"
  | "archived_reference"
  | "stale_market_price"

export interface AssetHealthFactor {
  id: AssetHealthFactorId
  status: "complete" | "attention" | "unavailable"
  score: number | null
  numerator: number
  denominator: number
  assetIds: string[]
  affectedAssetIds: string[]
}

export interface AssetQualityIssue {
  id: AssetQualityIssueId
  affectedAssetIds: string[]
  count: number
}

export interface AssetHealthAnalysis {
  score: number | null
  provisional: boolean
  factors: AssetHealthFactor[]
  issues: AssetQualityIssue[]
}

export interface AssetRelationshipEvidence {
  holdingId: string
  assetId: string
  accountId: string
  accountName: string
  quantity: Decimal
  unit: QuantityUnit
  averageCost: Decimal | null
  totalCostBasis: Decimal
  costCurrency: string
  marketValueBase: Decimal | null
  baseCurrency: string
  dataStatus: AssetDataStatus
  relatedActivityCount: number
}

export interface AssetActivityEntryEvidence {
  id: string
  accountId: string
  accountName: string
  assetId: string
  assetName: string
  side: "debit" | "credit"
  transactionAmount: Decimal
  accountAmount: Decimal
  quantityDelta: Decimal | null
  memo: string | null
}

export interface AssetActivityEvidence {
  id: string
  type: string
  description: string
  occurredAt: string
  postedAt: string
  originalCurrency: string
  originalAmount: Decimal
  assetIds: string[]
  accountIds: string[]
  entries: AssetActivityEntryEvidence[]
}

export interface AssetDetailViewModel {
  item: AssetInventoryItem
  relationships: AssetRelationshipEvidence[]
  activity: AssetActivityEvidence[]
}

export type AssetInventorySort =
  | "name"
  | "ownership"
  | "asset_class"
  | "currency"
  | "price_date"
  | "data_status"

export interface AssetAccountReference {
  id: string
  name: string
}

export interface AssetInventoryItem {
  asset: AssetSummary
  ownership: AssetOwnershipState
  lifecycle: AssetLifecycleState
  origin: AssetOrigin
  accounts: AssetAccountReference[]
  holdingCount: number
  currentPrice: Decimal | null
  priceCurrency: string | null
  priceTimestamp: string | null
  dataStatus: AssetDataStatus
  classificationComplete: boolean
  valuationSupported: boolean
  valuationReady: boolean
  fxRequired: boolean
  fxCovered: boolean
  missingExchangeRatePairs: Array<{
    sourceCurrencyCode: string
    destinationCurrencyCode: string
  }>
  referenceCount: number
}

export interface AssetClassOption {
  id: string
  count: number
}

export interface AssetWorkspaceSnapshot {
  items: AssetInventoryItem[]
  scopeOptions: AssetAccountReference[]
  assetClasses: AssetClassOption[]
  recordCount: number
  ownedCount: number
  issueCount: number
  updatedAt: string
  activeScopeId: string | null
  analysis: AssetHealthAnalysis
  relationships: AssetRelationshipEvidence[]
  activity: AssetActivityEvidence[]
  activityError: string | null
}

export interface AssetEvidenceFilters {
  relationshipAccountId: string | null
  activityAccountId: string | null
  activityType: string | null
}

export interface AssetWorkspaceFilters {
  search: string
  ownership: "all" | AssetOwnershipState
  accountId: string | null
  currency: string | null
  lifecycle: "all" | AssetLifecycleState
  origin: "all" | AssetOrigin
  sort: AssetInventorySort
  direction: "asc" | "desc"
}
