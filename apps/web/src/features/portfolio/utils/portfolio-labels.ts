import type { Translate } from "@/i18n/context"
import type { TranslationKey } from "@/i18n/en/translations"

const assetClassKeys: Record<string, TranslationKey> = {
  stock: "assetType.stock",
  etf: "assetType.etf",
  mutual_fund: "assetType.mutual_fund",
  bond: "assetType.bond",
  cryptocurrency: "assetType.cryptocurrency",
  commodity: "assetType.commodity",
  real_estate: "assetType.real_estate",
  business: "assetType.business",
  cash_equivalent: "assetType.cash_equivalent",
  other: "assetType.other",
  cash: "accountType.cash",
}

const quantityUnitKeys: Record<string, TranslationKey> = {
  shares: "holdings.unit.shares",
  grams: "holdings.unit.grams",
  kilograms: "holdings.unit.kilograms",
  troy_ounces: "holdings.unit.troy_ounces",
  coins: "holdings.unit.coins",
  property: "holdings.unit.property",
  ownership_units: "holdings.unit.ownership_units",
  currency_amount: "holdings.unit.currency_amount",
  units: "holdings.unit.units",
}

export function portfolioAssetClassLabel(
  assetClassId: string,
  translate: Translate,
): string {
  const key = assetClassKeys[assetClassId]
  return key ? translate(key) : assetClassId
}

export function portfolioQuantityUnitLabel(
  unit: string,
  translate: Translate,
): string {
  const key = quantityUnitKeys[unit]
  return key ? translate(key) : unit
}
