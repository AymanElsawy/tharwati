import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { LanguageContext, type Language } from "../../i18n/context"
import { en } from "../../i18n/en/translations"
import { ar } from "../../i18n/ar/translations"
import { PortfolioHoldingsEvidence } from "../../features/portfolio/components/PortfolioHoldingsEvidence"
import { PortfolioHeader } from "../../features/portfolio/components/PortfolioHeader"
import type { PortfolioExecutiveViewModel } from "../../features/portfolio/types/portfolio-executive"
import type { PortfolioHoldingEvidence } from "../../features/portfolio/types/portfolio-evidence"
import { formatPriceRetrievedAt, securityPriceLabel } from "./price-display"

const holding: PortfolioHoldingEvidence = {
  id: "holding", assetId: "asset", assetName: "Test security", symbol: "TEST",
  assetClass: "stock", accountId: "account", accountName: "Brokerage",
  quantity: "2", unit: "shares", averageCost: "40", totalCostBasis: "80",
  costCurrency: "USD", currentPrice: "50.123456789", priceCurrency: "USD",
  priceSource: "twelve_data", priceType: "realtime", priceStale: false,
  priceTimestamp: "2020-01-01T00:00:00Z", priceFetchedAt: "2026-10-02T12:00:00Z",
  marketValueBase: "100.246913578", unrealizedGainLossBase: "20.246913578",
  returnPercent: "25.3086419725", dataQuality: "complete",
}

function render(overrides: Partial<PortfolioHoldingEvidence> = {}, language: Language = "en") {
  const catalog = language === "ar" ? ar : en
  return renderToStaticMarkup(
    <LanguageContext.Provider value={{ language, direction: language === "ar" ? "rtl" : "ltr", setLanguage: () => {}, t: (key) => catalog[key] }}>
      <PortfolioHoldingsEvidence holdings={[{ ...holding, ...overrides }]} allCount={1} scopes={[]}
        baseCurrency="USD" filters={{ search: "", accountId: null, assetClass: null, sort: "asset", direction: "asc", hasInherited: false }}
        onSearch={() => {}} onAccount={() => {}} onAssetClass={() => {}} onSort={() => {}} onOpen={() => {}} />
    </LanguageContext.Provider>,
  )
}

describe("security price presentation", () => {
  it.each(["realtime", "delayed", null])("does not infer live freshness from %s", (type) => {
    expect(securityPriceLabel(true, "twelve_data", type)).toBe("securities.price.latest")
  })

  it.each([
    [false, "manual", "manual", true, "securities.price.unavailable"],
    [true, "manual", "realtime", true, "securities.price.manual"],
    [true, "twelve_data", "manual", false, "securities.price.manual"],
    [true, "twelve_data", "previous_close", true, "securities.price.previousClose"],
    [true, "twelve_data", "stale", false, "securities.price.lastKnown"],
    [true, "twelve_data", "realtime", true, "securities.price.lastKnown"],
  ] as const)("preserves distinct evidence labels (%s, %s, %s)", (available, provider, type, stale, key) => {
    expect(securityPriceLabel(available, provider, type, stale)).toBe(key)
  })

  it.each([null, undefined, "", "unknown", "2026-10-02", "2026-10-02T12:00:00"])("does not fabricate retrieval time from %s", (time) => {
    expect(formatPriceRetrievedAt(time, "en-US")).toBeNull()
    const html = render({ priceFetchedAt: time })
    expect(html).not.toContain("Last retrieved")
    expect(html).not.toContain("2020")
    expect(html).not.toContain("Oct 2")
  })

  for (const language of ["en", "ar"] as const) {
    const catalog = language === "en" ? en : ar
    it(`${language} portfolio status does not present legacy updatedAt as market or retrieval time`, () => {
      // Supply only the header's fields; even an invalid legacy timestamp must
      // not be rendered, replaced with now, or used to assert market freshness.
      const portfolio = { completenessStatus: "complete", updatedAt: "unknown", baseCurrency: "USD", activeScopeId: null, scopeOptions: [] } as unknown as PortfolioExecutiveViewModel
      const html = renderToStaticMarkup(
        <LanguageContext.Provider value={{ language, direction: language === "ar" ? "rtl" : "ltr", setLanguage: () => {}, t: (key) => catalog[key] }}>
          <PortfolioHeader portfolio={portfolio} isUpdating={false} onScopeChange={() => {}} />
        </LanguageContext.Provider>,
      )
      expect(html).toContain(catalog["portfolio.header.updated"])
      expect(html).not.toContain("unknown")
      expect(html).not.toContain("Last retrieved")
      expect(html).not.toContain("Market data is current")
    })
    it(`${language} renders latest price and real retrieval time, never effective time`, () => {
      const html = render({}, language)
      expect(html).toContain(catalog["securities.price.latest"])
      expect(html).toContain(catalog["portfolio.evidence.priceTime"])
      expect(html).toContain(formatPriceRetrievedAt(holding.priceFetchedAt, language === "en" ? "en-US" : "ar-SA")!)
      expect(html).not.toContain("2020")
      expect(html).not.toContain("realtime")
      expect(html).not.toContain("Current price")
      expect(html).toContain('dir="ltr"')
    })

    it.each([
      [{ priceType: "previous_close", priceStale: true }, "securities.price.previousClose"],
      [{ priceStale: true }, "securities.price.lastKnown"],
      [{ priceSource: "manual", priceStale: true }, "securities.price.manual"],
      [{ currentPrice: null }, "securities.price.unavailable"],
    ] as const)(`${language} renders truthful fallback label %s`, (overrides, key) => {
      expect(render(overrides, language)).toContain(catalog[key])
    })
  }

  it("does not call manual or unavailable evidence a retrieval", () => {
    for (const overrides of [{ priceSource: "manual" }, { priceType: "manual" }, { currentPrice: null }] as const) {
      expect(render(overrides)).not.toContain("Oct 2")
      expect(render(overrides)).not.toContain("Last retrieved")
    }
  })
})
