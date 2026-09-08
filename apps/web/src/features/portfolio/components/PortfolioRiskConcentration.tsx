import {
  AlertTriangle,
  ChevronDown,
  CircleOff,
  ShieldAlert,
} from "lucide-react"

import type {
  PortfolioAnalysisHolding,
  PortfolioRisk,
  PortfolioRiskId,
} from "@/features/portfolio/types/portfolio-analysis"
import { formatPortfolioPercent } from "@/features/portfolio/utils/portfolio-formatters"
import { useTranslation } from "@/i18n/useTranslation"

const summaryRiskIds: PortfolioRiskId[] = [
  "largest_holding",
  "top_five",
  "dominant_sector",
  "dominant_currency",
  "unpriced_exposure",
  "illiquid_exposure",
]

function riskTone(risk: PortfolioRisk) {
  if (risk.severity === "high") {
    return "text-rose-700 dark:text-rose-400"
  }
  if (risk.severity === "warning") {
    return "text-amber-700 dark:text-amber-400"
  }
  return "text-[var(--color-text-secondary)]"
}

type Props = {
  risks: PortfolioRisk[]
  holdings: PortfolioAnalysisHolding[]
  selectedRiskId: PortfolioRiskId | null
  onSelect: (id: PortfolioRiskId | null) => void
}

export function PortfolioRiskConcentration({
  risks,
  holdings,
  selectedRiskId,
  onSelect,
}: Props) {
  const { language, t } = useTranslation()
  const locale = language === "ar" ? "ar-SA" : "en-US"

  return (
    <section
      id="portfolio-concentration"
      aria-labelledby="portfolio-risk-title"
      className="scroll-mt-20"
    >
      <header className="tharwati-section-header">
        <p className="tharwati-eyebrow">
          {t("portfolio.analysis.eyebrow")}
        </p>
        <h2 id="portfolio-risk-title" className="tharwati-section-title mt-2">
          {t("portfolio.risk.title")}
        </h2>
        <p className="tharwati-section-description">
          {t("portfolio.risk.description")}
        </p>
      </header>

      <div className="grid border-y border-[var(--color-border)]/70 sm:grid-cols-2 lg:grid-cols-3">
        {summaryRiskIds.map((id) => {
          const risk = risks.find((candidate) => candidate.id === id)
          if (!risk) return null
          return (
            <div
              key={id}
              className="border-b border-[var(--color-border)]/60 px-5 py-5 sm:odd:border-e lg:border-e lg:[&:nth-child(3n)]:border-e-0"
            >
              <p className="text-xs text-[var(--color-text-secondary)]">
                {t(`portfolio.risk.metric.${id}`)}
              </p>
              <p className={`mt-2 text-xl font-bold ${riskTone(risk)}`}>
                {risk.available
                  ? risk.percentage
                    ? formatPortfolioPercent(risk.percentage, locale)
                    : risk.contributorIds.length
                  : "—"}
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {risk.available
                  ? t(`portfolio.risk.severity.${risk.severity}`)
                  : t("portfolio.risk.unavailable")}
              </p>
            </div>
          )
        })}
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-bold">
          {t("portfolio.risk.register")}
        </h3>
        <div className="mt-4 border-y border-[var(--color-border)]/70">
          {risks.map((risk) => {
            const expanded = selectedRiskId === risk.id
            const contributors = risk.contributorIds.flatMap((id) => {
              const holding = holdings.find((candidate) => candidate.id === id)
              return holding ? [holding] : []
            })
            const Icon = risk.available ? ShieldAlert : CircleOff
            return (
              <article
                key={risk.id}
                className="border-b border-[var(--color-border)]/60 last:border-b-0"
              >
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => onSelect(expanded ? null : risk.id)}
                  className="flex w-full items-center gap-4 px-1 py-4 text-start outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)]"
                >
                  <Icon
                    className={`size-5 shrink-0 ${riskTone(risk)}`}
                    strokeWidth={1.7}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      {t(`portfolio.risk.metric.${risk.id}`)}
                    </span>
                    <span className="mt-1 block text-sm text-[var(--color-text-secondary)]">
                      {t(`portfolio.risk.explanation.${risk.id}`)}
                    </span>
                  </span>
                  <span className={`shrink-0 text-sm font-bold ${riskTone(risk)}`}>
                    {risk.percentage
                      ? formatPortfolioPercent(risk.percentage, locale)
                      : risk.available
                        ? risk.contributorIds.length
                        : t("portfolio.risk.unavailable")}
                  </span>
                  <ChevronDown
                    className={`size-4 shrink-0 transition-transform ${
                      expanded ? "rotate-180" : ""
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {expanded ? (
                  <div className="animate-in fade-in slide-in-from-top-1 pb-5 ps-10 duration-150 motion-reduce:animate-none">
                    {risk.provisional ? (
                      <p className="mb-3 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
                        <AlertTriangle size={14} aria-hidden="true" />
                        {t("portfolio.risk.provisional")}
                      </p>
                    ) : null}
                    {risk.threshold ? (
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {t("portfolio.risk.threshold", {
                          threshold: formatPortfolioPercent(
                            risk.threshold,
                            locale,
                          ),
                        })}
                      </p>
                    ) : null}
                    {contributors.length > 0 ? (
                      <ul className="mt-3 flex flex-wrap gap-2">
                        {contributors.map((holding) => (
                          <li
                            key={holding.id}
                            className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-semibold"
                          >
                            {holding.name}
                            {holding.symbol ? ` · ${holding.symbol}` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
                        {t("portfolio.risk.noEvidence")}
                      </p>
                    )}
                    <a
                      href="#portfolio-health"
                      className="mt-4 inline-flex text-xs font-semibold text-[var(--color-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                    >
                      {t("portfolio.risk.healthConnection")}
                    </a>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
