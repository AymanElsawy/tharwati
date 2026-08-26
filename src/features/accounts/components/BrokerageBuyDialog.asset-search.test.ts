import { describe, expect, it } from "vitest"

import dialog from "./BrokerageBuyDialog.tsx?raw"

describe("Brokerage buy external asset selection UI contract", () => {
  it("resolves a clicked result, clears search, and leaves the Buy form usable", () => {
    const handlerStart = dialog.indexOf("const handleExternalResultSelected")
    const handlerEnd = dialog.indexOf("return <Dialog.Root", handlerStart)
    const handler = dialog.slice(handlerStart, handlerEnd)

    expect(dialog).toContain("onClick={() => void handleExternalResultSelected(result)}")
    expect(handler).toContain("await assetSearchService.resolve(result)")
    expect(handler).toContain("setAssetId(resolvedAsset.id)")
    expect(handler).toContain('setExternalSearchQuery("")')
    expect(handler).toContain("setExternalResults([])")
    expect(handler.indexOf("setAssetId(resolvedAsset.id)")).toBeLessThan(handler.indexOf('setExternalSearchQuery("")'))
    expect(dialog).toContain("externalSearchQuery.trim().length >= 2 && externalResults.length > 0")
    expect(dialog).toContain('value={assetId} onChange={(event) => setAssetId(event.target.value)}')
    expect(dialog).toContain('value={quantity} onChange={(event) => setQuantity(event.target.value)}')
    expect(handler).not.toContain("add_brokerage_buy")
  })

  it("keeps the existing catalog picker for normal buys", () => {
    expect(dialog).toContain('t("investment.asset.section")')
    expect(dialog).toContain('assetsRepository.searchAssets("", 100)')
  })
})