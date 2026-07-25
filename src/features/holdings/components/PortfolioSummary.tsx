import { WalletCards } from "lucide-react"

import { useTranslation } from "../../../i18n/useTranslation"
import type { CurrencyCostBasis } from "../../../lib/financial-calculations"
import { formatCostAmount } from "../utils/holding-formatters"

type Props = {
  totals: CurrencyCostBasis[]
}

export function PortfolioSummary({ totals }: Props) {
  const { language, t } = useTranslation()
  const locale = language === "ar" ? "ar-SA" : "en-US"

  return (
    <section aria-labelledby="portfolio-cost-basis-title" className="mb-5">
      <div className="mb-3 flex items-center gap-2">
        <WalletCards size={19} className="text-[var(--color-primary)]" />
        <h2 id="portfolio-cost-basis-title" className="font-bold">
          {t("holdings.summary.portfolioCostBasis")}
        </h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {totals.map((total) => (
          <article
            key={total.currencyCode}
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm"
          >
            <p
              className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]"
              dir="ltr"
            >
              {total.currencyCode}
            </p>
            <p className="mt-2 text-2xl font-black" dir="ltr">
              {formatCostAmount(
                total.totalCostBasis,
                total.currencyCode,
                locale,
              )}
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              {t("holdings.summary.openPositions", {
                count: total.holdingCount,
              })}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}

