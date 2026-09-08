import {
  AlertTriangle,
  BadgeDollarSign,
  CircleDollarSign,
  Gauge,
  Globe2,
  ShieldAlert,
} from "lucide-react"

import type {
  PortfolioExecutiveViewModel,
  PortfolioHealthFactorId,
} from "@/features/portfolio/types/portfolio-executive"
import { useTranslation } from "@/i18n/useTranslation"

const factorIcons = {
  diversification: Globe2,
  concentration: ShieldAlert,
  allocation: Gauge,
  cash: CircleDollarSign,
  currency: BadgeDollarSign,
  missing_data: AlertTriangle,
} satisfies Record<PortfolioHealthFactorId, typeof Gauge>

export function PortfolioHealth({
  portfolio,
  highlightedFactorId,
}: {
  portfolio: PortfolioExecutiveViewModel
  highlightedFactorId?: PortfolioHealthFactorId | null
}) {
  const { t } = useTranslation()

  return (
    <section
      id="portfolio-health"
      aria-labelledby="portfolio-health-title"
      className="overflow-hidden rounded-2xl border border-[var(--color-border)]/50 bg-[var(--color-surface)]"
    >
      <div className="grid lg:grid-cols-[minmax(15rem,0.7fr)_minmax(0,1.3fr)]">
        <div className="px-6 py-7 sm:px-9 sm:py-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
            {t("portfolio.health.eyebrow")}
          </p>
          <div className="mt-4 flex items-end gap-2">
            <p
              id="portfolio-health-title"
              className="text-6xl font-black tracking-[-0.06em]"
            >
              {portfolio.health.score ?? "—"}
            </p>
            {portfolio.health.score !== null ? (
              <span className="pb-1 text-sm text-[var(--color-text-secondary)]">
                / 100
              </span>
            ) : null}
          </div>
          <h2 className="mt-4 text-xl font-bold">
            {t(`portfolio.health.status.${portfolio.health.status}`)}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
            {portfolio.health.score === null
              ? t("portfolio.health.unavailable")
              : t("portfolio.health.description")}
          </p>
        </div>

        <div className="grid border-t border-[var(--color-border)]/60 sm:grid-cols-2 lg:border-s lg:border-t-0">
          {portfolio.health.factors.map((factor) => {
            const Icon = factorIcons[factor.id]
            const tone =
              factor.status === "good"
                ? "text-emerald-700 dark:text-emerald-400"
                : factor.status === "warning"
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-[var(--color-text-secondary)]"
            return (
              <div
                key={factor.id}
                className={`border-b border-[var(--color-border)]/60 px-5 py-4 last:border-b-0 sm:odd:border-e ${
                  highlightedFactorId === factor.id
                    ? "bg-[var(--color-surface-hover)] ring-1 ring-inset ring-[var(--color-primary)]/35"
                    : ""
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2.5 text-sm font-semibold">
                    <Icon
                      size={16}
                      strokeWidth={1.8}
                      className={tone}
                      aria-hidden="true"
                    />
                    {t(`portfolio.health.factor.${factor.id}`)}
                  </span>
                  <span className={`text-xs font-semibold ${tone}`}>
                    {factor.score}
                  </span>
                </div>
                <div
                  className="mt-3 h-1 overflow-hidden rounded-full bg-[var(--color-border)]"
                  role="progressbar"
                  aria-label={t(
                    `portfolio.health.factor.${factor.id}`,
                  )}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={factor.score}
                >
                  <div
                    className="h-full rounded-full bg-[var(--color-primary)] transition-[width] duration-200 motion-reduce:transition-none"
                    style={{ width: `${factor.score}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
