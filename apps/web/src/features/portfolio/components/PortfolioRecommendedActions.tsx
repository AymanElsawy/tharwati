import { ArrowRight, CheckCircle2 } from "lucide-react"
import { Link } from "react-router-dom"

import type { WealthInsight } from "@/features/insights/types/wealth-insight"
import { useTranslation } from "@/i18n/useTranslation"

export function PortfolioRecommendedActions({
  insights,
}: {
  insights: WealthInsight[]
}) {
  const { t } = useTranslation()
  const actions = insights.filter(
    (insight): insight is WealthInsight & {
      action: NonNullable<WealthInsight["action"]>
    } => insight.action !== undefined,
  )

  return (
    <section aria-labelledby="portfolio-actions-title">
      <header className="mb-5">
        <p className="tharwati-eyebrow">
          {t("portfolio.actions.eyebrow")}
        </p>
        <h2 id="portfolio-actions-title" className="tharwati-section-title mt-2">
          {t("portfolio.actions.title")}
        </h2>
      </header>

      {actions.length > 0 ? (
        <ol className="border-y border-[var(--color-border)]/70">
          {actions.map((insight, index) => (
            <li
              key={insight.id}
              className="grid items-center gap-3 border-b border-[var(--color-border)]/50 py-4 last:border-b-0 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto]"
            >
              <span className="text-xs font-semibold tabular-nums text-[var(--color-text-muted)]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="font-semibold text-[var(--color-text)]">
                  {insight.action.label}
                </h3>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  {insight.headline}
                </p>
              </div>
              <Link
                to={insight.action.href}
                className="flex items-center gap-1.5 ps-[3.25rem] text-sm font-semibold text-[var(--color-primary)] outline-none transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] sm:ps-0"
              >
                {t("portfolio.actions.begin")}
                <ArrowRight
                  className="size-4 rtl:rotate-180"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <div className="flex items-center gap-3 border-y border-[var(--color-border)]/60 py-5 text-sm">
          <CheckCircle2
            className="size-5 text-emerald-700 dark:text-emerald-400"
            aria-hidden="true"
          />
          <p className="text-[var(--color-text-secondary)]">
            {t("portfolio.actions.empty")}
          </p>
        </div>
      )}
    </section>
  )
}
