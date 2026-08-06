import { CircleOff } from "lucide-react"
import { useState } from "react"

import type { PortfolioExposure } from "@/features/portfolio/types/portfolio-analysis"
import {
  formatPortfolioAmount,
  formatPortfolioPercent,
} from "@/features/portfolio/utils/portfolio-formatters"
import { portfolioAssetClassLabel } from "@/features/portfolio/utils/portfolio-labels"
import { useTranslation } from "@/i18n/useTranslation"

type Props = {
  exposures: PortfolioExposure[]
  selectedId: string | null
  baseCurrency: string
  isPartial: boolean
  onSelect: (id: string | null) => void
}

export function PortfolioAllocationExplorer({
  exposures,
  selectedId,
  baseCurrency,
  isPartial,
  onSelect,
}: Props) {
  const { language, t } = useTranslation()
  const exposureLabel = (exposure: PortfolioExposure) =>
    portfolioAssetClassLabel(exposure.label, t)
  const locale = language === "ar" ? "ar-SA" : "en-US"
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const emphasizedId = hoveredId ?? selectedId
  const selected =
    exposures.find((exposure) => exposure.id === selectedId) ??
    exposures[0] ??
    null
  const active =
    exposures.find((exposure) => exposure.id === hoveredId) ?? selected

  return (
    <section
      id="portfolio-allocation"
      aria-labelledby="portfolio-allocation-title"
      className="scroll-mt-20"
    >
      <header className="tharwati-section-header">
        <p className="tharwati-eyebrow">
          {t("portfolio.analysis.eyebrow")}
        </p>
        <h2 id="portfolio-allocation-title" className="tharwati-section-title mt-2">
          {t("portfolio.allocation.title")}
        </h2>
        <p className="tharwati-section-description">
          {t("portfolio.allocation.description")}
        </p>
      </header>

      {exposures.length === 0 ? (
        <div className="flex items-start gap-3 border-y border-[var(--color-border)]/60 py-8">
          <CircleOff
            className="size-5 text-[var(--color-text-muted)]"
            aria-hidden="true"
          />
          <div>
            <h3 className="font-semibold">
              {t("portfolio.allocation.emptyTitle")}
            </h3>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {t("portfolio.allocation.emptyDescription")}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid overflow-hidden border-y border-[var(--color-border)]/70 bg-[var(--color-surface)] lg:grid-cols-2">
          <div className="p-6 sm:p-8">
            <div className="flex flex-col items-center gap-8 sm:flex-row">
              <div className="relative size-48 shrink-0">
                <svg
                  viewBox="0 0 120 120"
                  className="size-full -rotate-90"
                  role="img"
                  aria-label={t("portfolio.allocation.chartLabel")}
                >
                  <circle
                    cx="60"
                    cy="60"
                    r="48"
                    fill="none"
                    stroke="var(--color-border)"
                    strokeWidth="12"
                  />
                  {exposures.map((exposure) => {
                    const emphasized = emphasizedId === exposure.id
                    return (
                      <circle
                        key={exposure.id}
                        cx="60"
                        cy="60"
                        r="48"
                        fill="none"
                        pathLength="100"
                        stroke={exposure.color}
                        strokeWidth={emphasized ? 14 : 12}
                        strokeDasharray={`${exposure.percentage} 100`}
                        strokeDashoffset={`-${exposure.offsetPercentage}`}
                        opacity={
                          emphasizedId && !emphasized ? 0.38 : 1
                        }
                        role="button"
                        tabIndex={0}
                        aria-pressed={selectedId === exposure.id}
                        aria-label={`${exposureLabel(exposure)}, ${formatPortfolioPercent(exposure.percentage, locale)}, ${formatPortfolioAmount(exposure.value, baseCurrency, locale)}`}
                        className="cursor-pointer transition-[opacity,stroke-width] duration-150 focus:outline-none motion-reduce:transition-none"
                        onMouseEnter={() => setHoveredId(exposure.id)}
                        onMouseLeave={() => setHoveredId(null)}
                        onFocus={() => setHoveredId(exposure.id)}
                        onBlur={() => setHoveredId(null)}
                        onClick={() => onSelect(exposure.id)}
                        onKeyDown={(event) => {
                          if (
                            event.key === "Enter" ||
                            event.key === " "
                          ) {
                            event.preventDefault()
                            onSelect(exposure.id)
                          }
                        }}
                      />
                    )
                  })}
                </svg>
                <div
                  className="pointer-events-none absolute inset-7 flex flex-col items-center justify-center rounded-full bg-[var(--color-surface)] text-center"
                  aria-live="polite"
                >
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {active ? exposureLabel(active) : ""}
                  </span>
                  <strong className="mt-1 text-2xl font-black tabular-nums">
                    {active
                      ? formatPortfolioPercent(
                          active.percentage,
                          locale,
                        )
                      : "—"}
                  </strong>
                  <span className="mt-1 text-[10px] font-semibold text-[var(--color-text-secondary)]">
                    {active
                      ? formatPortfolioAmount(
                          active.value,
                          baseCurrency,
                          locale,
                        )
                      : ""}
                  </span>
                </div>
              </div>

              <div className="w-full" aria-label={t("portfolio.allocation.legend")}>
                {exposures.map((exposure) => {
                  const emphasized = emphasizedId === exposure.id
                  return (
                    <button
                      key={exposure.id}
                      type="button"
                      aria-pressed={selectedId === exposure.id}
                      onMouseEnter={() => setHoveredId(exposure.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onFocus={() => setHoveredId(exposure.id)}
                      onBlur={() => setHoveredId(null)}
                      onClick={() => onSelect(exposure.id)}
                      className={`flex w-full items-center justify-between gap-4 border-b border-[var(--color-border)]/60 py-2.5 text-start outline-none transition-opacity last:border-b-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)] ${
                        emphasizedId && !emphasized
                          ? "opacity-45"
                          : "opacity-100"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2.5 text-sm">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: exposure.color }}
                          aria-hidden="true"
                        />
                        <span className="truncate">
                          {exposureLabel(exposure)}
                        </span>
                      </span>
                      <span className="text-sm font-bold tabular-nums">
                        {formatPortfolioPercent(
                          exposure.percentage,
                          locale,
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <ul className="sr-only">
              {exposures.map((exposure) => (
                <li key={exposure.id}>
                  {exposureLabel(exposure)}:{" "}
                  {formatPortfolioPercent(exposure.percentage, locale)},{" "}
                  {formatPortfolioAmount(
                    exposure.value,
                    baseCurrency,
                    locale,
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-[var(--color-border)]/60 p-6 sm:p-8 lg:border-s lg:border-t-0">
            <div
              key={selected?.id}
              className="animate-in fade-in slide-in-from-right-1 duration-150 motion-reduce:animate-none"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
                {t("portfolio.allocation.contributors")}
              </p>
              <h3 className="mt-2 text-lg font-bold">
                {selected ? exposureLabel(selected) : "—"}
              </h3>
              {selected && selected.contributors.length > 0 ? (
                <div className="mt-5 divide-y divide-[var(--color-border)]/60">
                  {selected.contributors.map((contributor) => (
                    <div
                      key={contributor.id}
                      className="flex items-center justify-between gap-4 py-3.5 first:pt-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {contributor.name}
                        </p>
                        {contributor.detail ? (
                          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                            {contributor.detail}
                          </p>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-end">
                        <p className="text-sm font-semibold" dir="ltr">
                          {formatPortfolioAmount(
                            contributor.value,
                            baseCurrency,
                            locale,
                          )}
                        </p>
                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                          {formatPortfolioPercent(
                            contributor.percentage,
                            locale,
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-6 text-sm leading-6 text-[var(--color-text-secondary)]">
                  {t("portfolio.allocation.noContributors")}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {isPartial ? (
        <p className="mt-4 text-xs text-amber-800 dark:text-amber-300">
          {t("portfolio.analysis.partial")}
        </p>
      ) : null}
    </section>
  )
}
