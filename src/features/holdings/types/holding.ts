import type {
  AccountSummary,
  AssetSummary,
  TableRow,
} from "../../../lib/supabase/types"

export type HoldingDetails = TableRow<"holdings"> & {
  asset: Pick<
    AssetSummary,
    | "id"
    | "name"
    | "symbol"
    | "asset_type_code"
    | "currency_code"
    | "canonical_quantity_unit"
  >
  account: Pick<
    AccountSummary,
    "id" | "name" | "currency_code"
  >
}

export type HoldingUnit =
  | "shares"
  | "grams"
  | "kilograms"
  | "troy_ounces"
  | "coins"
  | "property"
  | "ownership_units"
  | "currency_amount"
  | "units"

export function getHoldingUnit(holding: HoldingDetails): HoldingUnit {
  if (holding.asset.canonical_quantity_unit) {
    return holding.asset.canonical_quantity_unit
  }
  const type = holding.asset.asset_type_code
  if (["stock", "etf", "mutual_fund", "bond"].includes(type)) {
    return "shares"
  }
  if (
    type === "commodity" &&
    ["XAU", "XAG"].includes(holding.asset.symbol ?? "")
  ) {
    return "troy_ounces"
  }
  if (type === "cryptocurrency") return "coins"
  if (type === "real_estate") return "property"
  if (type === "business") return "ownership_units"
  if (type === "cash_equivalent") return "currency_amount"
  return "units"
}
