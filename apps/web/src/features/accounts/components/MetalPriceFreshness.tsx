import type { ResolvedMetalPrice } from "@/services/metalPriceService"
import { useTranslation } from "@/i18n/useTranslation"
import { formatLocalDateTime } from "@/lib/formatting/local-date-time"

export function MetalPriceFreshness({
  quote,
}: {
  quote: ResolvedMetalPrice | null
}) {
  const { t, language } = useTranslation()
  if (!quote || (!quote.stale && !quote.fxStale)) return null
  const timestamp = formatLocalDateTime(
    quote.effectiveAt,
    language === "ar" ? "ar-SA" : "en-US"
  )
  return (
    <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
      {quote.stale ? (
        <>
          {t("accounts.metalPrice.stale")} ·{" "}
          <span dir="ltr">
            {timestamp.date} {timestamp.time}
          </span>
        </>
      ) : (
        t("accounts.metalPrice.staleFx")
      )}
    </p>
  )
}
