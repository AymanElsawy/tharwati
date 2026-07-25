import type {
  AccountSummary,
  AssetSummary,
  Decimal,
  TableRow,
} from "../../../lib/supabase/types"

export type AddInvestmentValues = {
  accountMode: "existing" | "new"
  accountId: string
  newAccountTypeCode: string
  newAccountName: string
  newAccountCurrencyCode: string
  newAccountInstitutionName: string
  assetMode: "existing" | "new"
  assetId: string
  newAssetTypeCode: string
  newAssetName: string
  newAssetSymbol: string
  newAssetCurrencyCode: string
  newAssetExchange: string
  quantity: Decimal
  unit: string
  unitPrice: Decimal
  fees: Decimal
  occurredAt: string
  notes: string
}

export type AddInvestmentResult = {
  account: AccountSummary
  asset: AssetSummary
  asset_identifiers: TableRow<"asset_identifiers">[]
  transaction: TableRow<"financial_transactions">
  entries: TableRow<"transaction_entries">[]
  holding: TableRow<"holdings">
}

export const defaultAddInvestmentValues: AddInvestmentValues = {
  accountMode: "existing",
  accountId: "",
  newAccountTypeCode: "brokerage",
  newAccountName: "",
  newAccountCurrencyCode: "USD",
  newAccountInstitutionName: "",
  assetMode: "existing",
  assetId: "",
  newAssetTypeCode: "stock",
  newAssetName: "",
  newAssetSymbol: "",
  newAssetCurrencyCode: "USD",
  newAssetExchange: "",
  quantity: "",
  unit: "shares",
  unitPrice: "",
  fees: "0",
  occurredAt: new Date().toISOString().slice(0, 10),
  notes: "",
}
