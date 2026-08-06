import type { AssetFormValues } from "@/features/assets/types/asset-form"

export function normalizeAssetForm(values: AssetFormValues) {
  return { assetTypeCode: values.assetTypeCode.trim(), name: values.name.trim(), symbol: values.symbol.trim(), currencyCode: values.currencyCode.trim().toUpperCase(), exchange: values.exchange.trim(), isActive: values.isActive }
}

export function hasMeaningfulAssetChanges(current: AssetFormValues, initial: AssetFormValues): boolean {
  return JSON.stringify(normalizeAssetForm(current)) !== JSON.stringify(normalizeAssetForm(initial))
}
