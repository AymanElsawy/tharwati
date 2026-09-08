import { AlertTriangle, CircleDollarSign } from "lucide-react"

import type { PortfolioExecutiveViewModel } from "@/features/portfolio/types/portfolio-executive"
import {
  formatPortfolioAmount,
  formatPortfolioPercent,
} from "@/features/portfolio/utils/portfolio-formatters"
import { useTranslation } from "@/i18n/useTranslation"

export function PortfolioValuePerformance({
  portfolio,
}: {
  portfolio: PortfolioExecutiveViewModel
}) {
  const { language, t } = useTranslation()
  const locale = language === "ar" ? "ar-SA" : "en-US"

  if (portfolio.isEmpty) {
    return (
      <section
        aria-labelledby="portfolio-value-title"
        className="rounded-2xl border border-[var(--color-border)]/50 bg-[var(--color-surface)] px-6 py-10 sm:px-10"
      >
        <CircleDollarSign
          className="size-6 text-[var(--color-primary)]"
          strokeWidth={1.6}
          aria-hidden="true"
        />
        <h2 id="portfolio-value-title" className="mt-5 text-xl font-bold">
          {t("portfolio.empty.title")}
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--color-text-secondary)]">
          {t("portfolio.empty.description")}
        </p>
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("tharwati:add-investment"),
            )
          }
          className="tharwati-button-primary mt-6"
        >
          {t("investment.primaryAction")}
        </button>
      </section>
    )
  }

  const performanceClass =
    portfolio.value.performanceDirection === "positive"
      ? "text-emerald-700 dark:text-emerald-400"
      : portfolio.value.performanceDirection === "negative"
        ? "text-rose-700 dark:text-rose-400"
        : "text-[var(--color-text-secondary)]"

  return (
    <section
      aria-labelledby="portfolio-value-title"
      className="overflow-hidden rounded-2xl border border-[var(--color-border)]/50 bg-[var(--color-surface)]"
    >
      <div className="grid lg:grid-cols-[minmax(0,1.7fr)_minmax(16rem,0.7fr)]">
        <div className="px-6 py-8 sm:px-10 sm:py-10">
          <p
            id="portfolio-value-title"
            className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]"
          >
            {t("portfolio.value.marketValue")}
          </p>
          <p
            className="mt-3 text-[clamp(2.5rem,6vw,5.25rem)] font-black leading-none tracking-[-0.06em] text-[var(--color-text)]"
            dir="ltr"
          >
            {formatPortfolioAmount(
              portfolio.value.marketValue,
              portfolio.baseCurrency,
              locale,
            )}
          </p>

          <div
            className={`mt-5 flex flex-wrap items-baseline gap-x-5 gap-y-2 ${performanceClass}`}
          >
            <p className="text-lg font-bold" dir="ltr">
              {formatPortfolioAmount(
                portfolio.value.unrealizedGainLoss,
                portfolio.baseCurrency,
                locale,
              )}
            </p>
            <p className="text-sm font-semibold" dir="ltr">
              {formatPortfolioPercent(
                portfolio.value.unrealizedReturnPercent,
                locale,
              )}
            </p>
            <span className="sr-only">
              {t("portfolio.value.unrealized")}
            </span>
          </div>

          {portfolio.completenessStatus !== "complete" ? (
            <p className="mt-5 flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle size={15} aria-hidden="true" />
              {t("portfolio.value.partial")}
            </p>
          ) : null}
          {(portfolio.fxRates ?? []).some((rate) => rate.stale) ? (
            <p className="mt-3 text-sm text-amber-800 dark:text-amber-300">
              {t("fx.cachedRate")}
            </p>
          ) : null}
        </div>

        <dl className="grid border-t border-[var(--color-border)]/60 lg:border-s lg:border-t-0">
          <div className="px-6 py-5 sm:px-8">
            <dt className="text-xs text-[var(--color-text-secondary)]">
              {t("portfolio.value.costBasis")}
            </dt>
            <dd className="mt-2 text-lg font-bold" dir="ltr">
              {formatPortfolioAmount(
                portfolio.value.costBasis,
                portfolio.baseCurrency,
                locale,
              )}
            </dd>
          </div>
          <div className="border-t border-[var(--color-border)]/60 px-6 py-5 sm:px-8">
            <dt className="text-xs text-[var(--color-text-secondary)]">
              {t("portfolio.value.openHoldings")}
            </dt>
            <dd className="mt-2 text-lg font-bold tabular-nums">
              {portfolio.value.openHoldingsCount}
            </dd>
          </div>
          <div className="border-t border-[var(--color-border)]/60 px-6 py-5 sm:px-8">
            <dt className="text-xs text-[var(--color-text-secondary)]">
              {t("portfolio.value.coverage")}
            </dt>
            <dd className="mt-2 text-sm font-semibold">
              {t("portfolio.value.coverageCount", {
                valued: portfolio.value.valuedHoldingsCount,
                total: portfolio.value.openHoldingsCount,
              })}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
