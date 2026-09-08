import { CheckCircle2 } from "lucide-react"

import { WealthInsightCards } from "@/features/insights/components/WealthInsights"
import type { WealthInsight } from "@/features/insights/types/wealth-insight"
import { useTranslation } from "@/i18n/useTranslation"

export function PortfolioAttentionSummary({
  insights,
}: {
  insights: WealthInsight[]
}) {
  const { t } = useTranslation()
  return (
    <section
      aria-labelledby="portfolio-attention-title"
      className="scroll-mt-20"
    >
      <header className="mb-6">
        <p className="tharwati-eyebrow">
          {t("portfolio.attention.eyebrow")}
        </p>
        <h2 id="portfolio-attention-title" className="tharwati-section-title mt-2">
          {t("portfolio.attention.title")}
        </h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          {t("portfolio.attention.description")}
        </p>
      </header>
      {insights.length > 0 ? (
        <WealthInsightCards insights={insights} />
      ) : (
        <div className="flex items-start gap-3 border-y border-[var(--color-border)]/60 py-6">
          <CheckCircle2
            className="mt-0.5 size-5 text-emerald-700 dark:text-emerald-400"
            aria-hidden="true"
          />
          <div>
            <h3 className="font-semibold">
              {t("portfolio.attention.emptyTitle")}
            </h3>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {t("portfolio.attention.emptyDescription")}
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
