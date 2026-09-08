import type { Translate } from "../../../i18n/context"
import type { AssetSummary } from "../../../lib/supabase/types"
import { currencyOptions } from "../../accounts/types/account-form"

export const assetTypeOptions = [
  { value: "stock", labelKey: "assetType.stock" },
  { value: "etf", labelKey: "assetType.etf" },
  { value: "mutual_fund", labelKey: "assetType.mutual_fund" },
  { value: "bond", labelKey: "assetType.bond" },
  { value: "cryptocurrency", labelKey: "assetType.cryptocurrency" },
  { value: "commodity", labelKey: "assetType.commodity" },
  { value: "real_estate", labelKey: "assetType.real_estate" },
  { value: "business", labelKey: "assetType.business" },
  { value: "cash_equivalent", labelKey: "assetType.cash_equivalent" },
  { value: "other", labelKey: "assetType.other" },
] as const

export { currencyOptions }

export const assetTypeCodes = assetTypeOptions.map(
  (option) => option.value,
) as [
  (typeof assetTypeOptions)[number]["value"],
  ...(typeof assetTypeOptions)[number]["value"][],
]

export const assetCurrencyCodes = currencyOptions.map(
  (option) => option.value,
) as [
  (typeof currencyOptions)[number]["value"],
  ...(typeof currencyOptions)[number]["value"][],
]

export type AssetFormValues = {
  assetTypeCode: (typeof assetTypeCodes)[number]
  name: string
  symbol: string
  currencyCode: (typeof assetCurrencyCodes)[number]
  exchange: string
  isActive: boolean
}

export const emptyAssetFormValues: AssetFormValues = {
  assetTypeCode: "stock",
  name: "",
  symbol: "",
  currencyCode: "USD",
  exchange: "",
  isActive: true,
}

export function assetToFormValues(asset: AssetSummary): AssetFormValues {
  return {
    assetTypeCode:
      asset.asset_type_code as AssetFormValues["assetTypeCode"],
    name: asset.name,
    symbol: asset.symbol ?? "",
    currencyCode:
      asset.currency_code as AssetFormValues["currencyCode"],
    exchange: asset.exchange ?? "",
    isActive: asset.is_active,
  }
}

export function getAssetTypeLabel(code: string, t: Translate): string {
  const option = assetTypeOptions.find((item) => item.value === code)
  return option ? t(option.labelKey) : code.replaceAll("_", " ")
}
