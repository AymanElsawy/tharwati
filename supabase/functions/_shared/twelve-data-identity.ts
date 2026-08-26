export type TwelveDataAssetReference = {
  id: string
  symbol: string | null
}

export type TwelveDataIdentifier = {
  asset_id: string
  namespace: string
  normalized_value: string
}

export type TwelveDataInstrument = {
  assetId: string
  symbol: string
  micCode: string
}

const providerNamespacePrefix = "twelve_data:"
const micCodePattern = /^[A-Z0-9]{4}$/
const symbolPattern = /^[A-Z0-9][A-Z0-9._-]*$/

export function resolveTwelveDataInstrument(
  asset: TwelveDataAssetReference,
  identifiers: readonly TwelveDataIdentifier[],
): TwelveDataInstrument | null {
  const assetSymbol = asset.symbol?.trim().toUpperCase()
  if (!assetSymbol || !symbolPattern.test(assetSymbol)) return null

  for (const identifier of identifiers) {
    if (identifier.asset_id !== asset.id) continue

    const namespace = identifier.namespace.trim().toLowerCase()
    if (!namespace.startsWith(providerNamespacePrefix)) continue

    const micCode = namespace.slice(providerNamespacePrefix.length).toUpperCase()
    const symbol = identifier.normalized_value.trim().toUpperCase()
    if (!micCodePattern.test(micCode) || !symbolPattern.test(symbol) || symbol !== assetSymbol) {
      continue
    }

    return { assetId: asset.id, symbol, micCode }
  }

  return null
}
