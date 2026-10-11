import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { LanguageContext, type Language } from "@/i18n/context"
import { en } from "@/i18n/en/translations"
import { ar } from "@/i18n/ar/translations"
import { formatPriceRetrievedAt } from "@/services/market-data/price-display"
import { formatPortfolioPercent } from "@/features/portfolio/utils/portfolio-formatters"
import { formatLocalDateTime } from "@/lib/formatting/local-date-time"
import { BrokerageHoldingDetailsPage } from "./BrokerageHoldingDetailsPage"

const state = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0 }))
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>()
  return {
    ...actual,
    // Seed the page's read-only loaded state; repositories and effects never run.
    useState: (initial: unknown) => state.cursor < state.values.length
      ? [state.values[state.cursor++], vi.fn()]
      : actual.useState(initial),
  }
})
vi.mock("react-router-dom", () => ({ useParams: () => ({ accountId: "account", assetId: "asset" }), useNavigate: () => vi.fn() }))
vi.mock("@/features/accounts/hooks/useAccounts", () => ({ useAccounts: () => ({ accounts: [{ id: "account", account_type_code: "brokerage" }], isLoading: false }) }))
vi.mock("@/features/holdings/repositories/holdings.repository", () => ({ holdingsRepository: {} }))
vi.mock("@/features/portfolio-valuation/services/portfolio-valuation.service", () => ({ portfolioValuationService: {} }))
vi.mock("@/features/accounts/components/BrokerageSellDialog", () => ({ BrokerageSellDialog: () => null }))

const fetchedAt = "2026-10-02T12:34:56+03:00"
const occurredAt = "2026-10-01T15:20:00+03:00"
const quantity = "2.0000000000"
const amount = "500.1234567890"
const percent = "-12.3456789"

function render(language: Language, missingPrice = false) {
  const catalog = language === "ar" ? ar : en
  const holding = { asset: { name: "Vanguard S&P 500 ETF", symbol: "VOO", exchange: "NYSE", currency_code: "USD" }, quantity, average_cost: amount, total_cost_basis: "1000.2469135780", cost_currency_code: "USD" }
  const valuation = { marketPrice: amount, marketPriceSource: "twelve_data", marketPriceType: "realtime", marketPriceFetchedAt: fetchedAt, marketPriceCurrency: "USD", stalePrice: false, unrealizedGainLossNative: "-123.4567890", unrealizedReturnPercent: percent }
  const history = [{ id: "history", transaction_type_code: "opening_position", occurred_at: occurredAt, entries: [{ asset_id: "asset", quantity_delta: quantity, unit_price: amount, account_cost_basis_delta: "1000.2469135780", account_fx_rate: null }] }]
  state.cursor = 0
  state.values = [holding, missingPrice ? null : valuation, false, history, false, false, null, null, null, false, null, false, false]
  return renderToStaticMarkup(
    <LanguageContext.Provider value={{ language, direction: language === "ar" ? "rtl" : "ltr", setLanguage: vi.fn(), t: (key) => catalog[key] }}>
      <div dir={language === "ar" ? "rtl" : "ltr"}><BrokerageHoldingDetailsPage /></div>
    </LanguageContext.Provider>,
  )
}

function encoded(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;")
}

describe("Brokerage Holding Details direction", () => {
  for (const language of ["en", "ar"] as const) {
    const catalog = language === "ar" ? ar : en
    const locale = language === "ar" ? "ar-SA" : "en-US"

    it(`${language} keeps label and isolated value in one start-aligned summary cell`, () => {
      const html = render(language)
      expect(html).toContain(`dir="${language === "ar" ? "rtl" : "ltr"}"`)
      expect(html).toContain(`<div class="min-w-0 px-4 py-4 text-start"><p class="text-xs font-medium text-muted-foreground">${catalog["holdings.table.quantity"]}</p><p class="mt-1 font-semibold break-words tabular-nums"><bdi dir="ltr">${quantity}</bdi></p></div>`)
      expect(html).not.toMatch(/<p[^>]*dir="ltr"/)
      expect(html).not.toMatch(/<strong[^>]*dir="ltr"/)
      expect(html).toContain("sm:grid-cols-2")
      expect(html).toContain("sm:grid-cols-4")
    })

    it(`${language} isolates formatted currencies and signed percentages without changing strings`, () => {
      const html = render(language)
      const currency = new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(amount))
      expect(html).toContain(`<bdi dir="ltr">${encoded(currency)}</bdi>`)
      expect(html).toContain(`<bdi dir="ltr">${encoded(formatPortfolioPercent(percent, locale))}</bdi>`)
      expect(html).toContain(catalog["securities.price.latest"])
    })

    it(`${language} keeps localized retrieval and history times isolated with unchanged timezone formatting`, () => {
      const html = render(language)
      expect(html).toContain(catalog["securities.price.lastRetrieved"])
      expect(html).toContain(`<bdi dir="ltr">${encoded(formatPriceRetrievedAt(fetchedAt, locale)!)}</bdi>`)
      expect(html).toContain(`<bdi dir="ltr">${encoded(formatLocalDateTime(occurredAt, locale).time)}</bdi>`)
    })

    it(`${language} aligns the ticker beneath the title while keeping VOO before NYSE`, () => {
      const html = render(language)
      expect(html).toContain('pb-7 text-start')
      expect(html).toContain('<h1 class="tharwati-page-title mt-2">Vanguard S&amp;P 500 ETF</h1><p class="mt-2 text-sm text-muted-foreground"><bdi dir="ltr">VOO · NYSE</bdi></p>')
    })

    it(`${language} preserves unavailable price labels without inventing retrieval time`, () => {
      const html = render(language, true)
      expect(html).toContain(catalog["securities.price.unavailable"])
      expect(html).toContain(`<bdi dir="ltr">${catalog["brokerage.marketValueUnavailable"]}</bdi>`)
      expect(html).not.toContain(catalog["securities.price.lastRetrieved"])
    })
  }
})
