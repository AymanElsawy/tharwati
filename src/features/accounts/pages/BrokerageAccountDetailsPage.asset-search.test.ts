import { describe, expect, it } from "vitest"

import page from "./BrokerageAccountDetailsPage.tsx?raw"

describe("Brokerage external asset selection UI contract", () => {
  it("resolves only after a result click and selects the returned catalog asset", () => {
    const handlerStart = page.indexOf("const handleExternalResultSelected")
    const handlerEnd = page.indexOf("return (", handlerStart)
    const handler = page.slice(handlerStart, handlerEnd)

    expect(page).toContain(
      "onClick={() => void handleExternalResultSelected(result)}",
    )
    expect(handler).toContain("await assetSearchService.resolve(result)")
    expect(handler).toContain("setAssetId(asset.id)")
    expect(handler).not.toContain("add_existing_holding")
  })

  it("keeps manual asset creation available as a fallback", () => {
    expect(page).toContain('t("brokerage.addAssetManually")')
    expect(page).toContain("setIsAssetDialogOpen(true)")
  })

  it("labels the optional country control as a listing-search filter", () => {
    expect(page).toContain('t("brokerage.externalAssetSearchCountry")')
    expect(page).toContain('t("brokerage.externalAssetSearchCountryHelp")')
    expect(page).toContain('t("brokerage.searchExternalAssetsAllCountries")')
  })

  it("stacks search controls on mobile and gives the country control desktop room", () => {
    expect(page).toContain("flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-2")
    expect(page).toContain("w-full sm:w-[clamp(15rem,28vw,18rem)] sm:shrink-0")
  })
})
