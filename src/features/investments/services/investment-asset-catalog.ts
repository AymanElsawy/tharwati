import type { AssetSummary } from "../../../lib/supabase/types"

export function filterInvestmentAssetCatalog(
  assets: readonly AssetSummary[],
  query: string,
): AssetSummary[] {
  const term = query.trim().toLocaleLowerCase()
  if (!term) return [...assets]
  return assets.filter((asset) =>
    [asset.name, asset.symbol, asset.exchange, asset.currency_code].some(
      (value) => value?.toLocaleLowerCase().includes(term),
    ),
  )
}
