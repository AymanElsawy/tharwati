import { CircleDollarSign, CircleOff, Globe2, ShieldAlert } from "lucide-react"
import type { ReactNode } from "react"

import type { WealthAnalysisEvidence } from "@/features/analysis/utils/wealth-analysis"
import type { DashboardAggregate } from "@/features/dashboard/services/dashboard-aggregate.service"
import {
  formatPortfolioAmount,
  formatPortfolioPercent,
} from "@/features/portfolio/utils/portfolio-formatters"
import { useTranslation } from "@/i18n/useTranslation"

function AnalysisFact({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Globe2
  title: string
  children: ReactNode
}) {
  return (
    <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Icon className="size-5 text-[var(--color-primary)]" aria-hidden="true" />
        <h3 className="font-heading text-lg font-bold">{title}</h3>
      </div>
      <div className="mt-3">{children}</div>
    </article>
  )
}

export function WealthAnalysisDimensions({
  aggregate,
  evidence,
}: {
  aggregate: DashboardAggregate
  evidence: WealthAnalysisEvidence
}) {
  const { language, t } = useTranslation()
  const locale = language === "ar" ? "ar-EG" : "en-US"
  const cash = evidence.cashAndBankExposure
  const available = aggregate.status === "complete"

  return (
    <section aria-labelledby="wealth-dimensions-title">
      <header className="tharwati-section-header mb-5">
        <p className="tharwati-eyebrow">{t("analysis.dimensions.eyebrow")}</p>
        <h2 id="wealth-dimensions-title" className="tharwati-section-title mt-2">
          {t("analysis.dimensions.title")}
        </h2>
        <p className="tharwati-section-description">
          {t("analysis.dimensions.description")}
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <AnalysisFact icon={ShieldAlert} title={t("analysis.diversification.title")}>
          {available ? (
            <dl>
              <div>
                <dt className="text-sm text-[var(--color-text-secondary)]">
                  {t("analysis.diversification.spread")}
                </dt>
                <dd className="mt-1 text-xl font-black tabular-nums" dir="ltr">
                  {evidence.positiveAssetClassCount}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">
              {t("analysis.dimensions.unavailable")}
            </p>
          )}
        </AnalysisFact>

        <AnalysisFact icon={CircleDollarSign} title={t("analysis.liquidity.title")}>
          {available && cash ? (
            <dl className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
              <div>
                <dt className="text-sm text-[var(--color-text-secondary)]">
                  {t("analysis.liquidity.cashShare")}
                </dt>
                <dd className="mt-1 text-xl font-black tabular-nums" dir="ltr">
                  {cash.percentage === null
                    ? formatPortfolioPercent("0", locale)
                    : formatPortfolioPercent(cash.percentage, locale)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-[var(--color-text-secondary)]">
                  {t("analysis.liquidity.cashValue")}
                </dt>
                <dd className="mt-1 font-bold tabular-nums" dir="ltr">
                  {formatPortfolioAmount(
                    cash.value,
                    aggregate.baseCurrencyCode,
                    locale,
                  )}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">
              {t("analysis.dimensions.unavailable")}
            </p>
          )}
        </AnalysisFact>

        <AnalysisFact icon={Globe2} title={t("analysis.currency.title")}>
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <CircleOff className="size-4 shrink-0" aria-hidden="true" />
            <p>{t("analysis.currency.unavailable")}</p>
          </div>
        </AnalysisFact>
      </div>
    </section>
  )
}
