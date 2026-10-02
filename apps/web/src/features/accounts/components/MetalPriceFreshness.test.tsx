import { expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { MetalPriceFreshness } from "./MetalPriceFreshness"
import { en } from "@/i18n/en/translations"
import type { ResolvedMetalPrice } from "@/services/metalPriceService"

vi.mock("@/i18n/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: keyof typeof en) => en[key],
    language: "en",
  }),
}))
const quote: ResolvedMetalPrice = {
  symbol: "XAU",
  price: "4340",
  currency: "USD",
  provider: "gold-api",
  pricePerGram: "139",
  currencyCode: "USD",
  effectiveAt: "2026-09-01T00:00:00Z",
  fetchedAt: "2026-09-01T00:01:00Z",
  timestampBasis: "provider",
  stale: true,
}
it("labels last-known spot as stale with its quote date, never live", () => {
  const html = renderToStaticMarkup(<MetalPriceFreshness quote={quote} />)
  expect(html).toContain("Last-known metal spot price · Stale")
  expect(html).toContain("2026")
  expect(html).not.toContain("live")
})
it("fresh quote has no stale warning", () => {
  expect(
    renderToStaticMarkup(
      <MetalPriceFreshness quote={{ ...quote, stale: false }} />
    )
  ).toBe("")
})
it("stale FX is not misrepresented as a stale metal spot", () => {
  const html = renderToStaticMarkup(
    <MetalPriceFreshness quote={{ ...quote, stale: false, fxStale: true }} />
  )
  expect(html).toContain("Valuation uses a stale FX rate")
  expect(html).not.toContain("Last-known metal spot price")
})
