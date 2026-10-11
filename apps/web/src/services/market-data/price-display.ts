import type { TranslationKey } from "../../i18n/en/translations"

// Presentation only: the legacy realtime type does not verify market freshness.
export function securityPriceLabel(
  available: boolean,
  provider?: string | null,
  priceType?: string | null,
  stale = false,
): TranslationKey {
  if (!available) return "securities.price.unavailable"
  if (provider === "manual" || priceType === "manual") return "securities.price.manual"
  if (priceType === "previous_close") return "securities.price.previousClose"
  if (stale || priceType === "stale") return "securities.price.lastKnown"
  return "securities.price.latest"
}

export function formatPriceRetrievedAt(fetchedAt: string | null | undefined, locale: string): string | null {
  // Do not replace absent fetch time with effective time, render time, or a date.
  if (!fetchedAt || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.test(fetchedAt)) return null
  const date = new Date(fetchedAt)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date)
}
