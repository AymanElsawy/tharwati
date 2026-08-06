import { CircleOff } from "lucide-react"

import { PortfolioDataDisclosure } from "@/features/portfolio/components/PortfolioDataDisclosure"
import type {
  DiversificationDimensionId,
  PortfolioDiversificationDimension,
} from "@/features/portfolio/types/portfolio-analysis"
import {
  formatPortfolioAmount,
  formatPortfolioPercent,
} from "@/features/portfolio/utils/portfolio-formatters"
import { portfolioAssetClassLabel } from "@/features/portfolio/utils/portfolio-labels"
import { useTranslation } from "@/i18n/useTranslation"

const dimensions: DiversificationDimensionId[] = [
  "asset_class",
  "sector",
  "geography",
  "currency",
  "account",
]

type Props = {
  dimension: PortfolioDiversificationDimension
  selectedAssetClassId: string | null
  selectedExposureId: string | null
  baseCurrency: string
  onDimensionChange: (dimension: DiversificationDimensionId) => void
  onExposureChange: (id: string | null) => void
}

export function PortfolioDiversificationAnalysis({
  dimension,
  selectedAssetClassId,
  selectedExposureId,
  baseCurrency,
  onDimensionChange,
  onExposureChange,
}: Props) {
  const { language, t } = useTranslation()
  const locale = language === "ar" ? "ar-SA" : "en-US"
  const dominant = dimension.exposures[0] ?? null
  const selected =
    dimension.exposures.find(
      (exposure) => exposure.id === selectedExposureId,
    ) ?? null
  const label = (value: string) =>
    dimension.id === "asset_class"
      ? portfolioAssetClassLabel(value, t)
      : value

  return (
    <section
      id="portfolio-diversification"
      aria-labelledby="portfolio-diversification-title"
      className="scroll-mt-20"
    >
      <header className="tharwati-section-header">
        <p className="tharwati-eyebrow">
          {t("portfolio.analysis.eyebrow")}
        </p>
        <h2
          id="portfolio-diversification-title"
          className="tharwati-section-title mt-2"
        >
          {t("portfolio.diversification.title")}
        </h2>
        <p className="tharwati-section-description">
          {t("portfolio.diversification.description")}
        </p>
      </header>

      <div
        role="tablist"
        aria-label={t("portfolio.diversification.dimensions")}
        className="flex gap-1 overflow-x-auto border-b border-[var(--color-border)]"
      >
        {dimensions.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={dimension.id === item}
            onClick={() => onDimensionChange(item)}
            className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)] ${
              dimension.id === item
                ? "border-[var(--color-primary)] text-[var(--color-text)]"
                : "border-transparent text-[var(--color-text-secondary)]"
            }`}
          >
            {t(`portfolio.diversification.dimension.${item}`)}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        className="pt-7"
        key={`${dimension.id}-${selectedAssetClassId ?? "all"}`}
      >
        {selectedAssetClassId && dimension.id !== "asset_class" ? (
          <p className="mb-5 text-xs font-semibold text-[var(--color-primary)]">
            {t("portfolio.diversification.filtered", {
              assetClass: portfolioAssetClassLabel(
                selectedAssetClassId,
                t,
              ),
            })}
          </p>
        ) : null}

        {dimension.status === "unavailable" ? (
          <PortfolioDataDisclosure
            title={t("portfolio.diversification.unavailableTitle")}
            description={t(
              `portfolio.diversification.unavailable.${dimension.id}`,
            )}
          />
        ) : dimension.exposures.length === 0 ? (
          <div className="flex items-start gap-3 border-y border-[var(--color-border)]/60 py-7">
            <CircleOff
              className="size-5 text-[var(--color-text-muted)]"
              aria-hidden="true"
            />
            <p className="text-sm text-[var(--color-text-secondary)]">
              {t("portfolio.diversification.empty")}
            </p>
          </div>
        ) : (
          <>
            <p className="max-w-3xl text-xl font-bold tracking-[-0.025em] sm:text-2xl">
              {t("portfolio.diversification.dominant", {
                exposure: dominant ? label(dominant.label) : "",
                percentage: formatPortfolioPercent(
                  dominant?.percentage ?? null,
                  locale,
                ),
              })}
            </p>

            <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.6fr)]">
              <div className="space-y-3">
                {dimension.exposures.map((exposure) => (
                  <button
                    key={exposure.id}
                    type="button"
                    aria-pressed={selectedExposureId === exposure.id}
                    onClick={() =>
                      onExposureChange(
                        selectedExposureId === exposure.id
                          ? null
                          : exposure.id,
                      )
                    }
                    className="group block w-full rounded-lg px-2 py-2 text-start outline-none transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                  >
                    <span className="flex items-center justify-between gap-4 text-sm">
                      <span className="font-semibold">
                        {label(exposure.label)}
                      </span>
                      <span className="font-bold tabular-nums">
                        {formatPortfolioPercent(
                          exposure.percentage,
                          locale,
                        )}
                      </span>
                    </span>
                    <span className="mt-2 block h-2 overflow-hidden rounded-full bg-[var(--color-border)]">
                      <span
                        className="block h-full rounded-full transition-[width] duration-200 motion-reduce:transition-none"
                        style={{
                          width: `${exposure.percentage}%`,
                          backgroundColor: exposure.color,
                        }}
                      />
                    </span>
                    <span
                      className="mt-1.5 block text-xs text-[var(--color-text-secondary)]"
                      dir="ltr"
                    >
                      {formatPortfolioAmount(
                        exposure.value,
                        baseCurrency,
                        locale,
                      )}
                    </span>
                  </button>
                ))}
              </div>

              <div className="border-t border-[var(--color-border)]/60 pt-5 lg:border-s lg:border-t-0 lg:ps-7 lg:pt-0">
                <h3 className="text-sm font-bold">
                  {selected
                    ? label(selected.label)
                    : t("portfolio.diversification.contributors")}
                </h3>
                {selected ? (
                  <ul className="mt-4 divide-y divide-[var(--color-border)]/60">
                    {selected.contributors.map((contributor) => (
                      <li
                        key={contributor.id}
                        className="flex justify-between gap-4 py-3 text-sm first:pt-0"
                      >
                        <span className="min-w-0 truncate">
                          {contributor.name}
                        </span>
                        <span className="shrink-0 font-semibold">
                          {formatPortfolioPercent(
                            contributor.percentage,
                            locale,
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
                    {t("portfolio.diversification.selectExposure")}
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {dimension.status === "partial" ? (
          <p className="mt-5 text-xs text-amber-800 dark:text-amber-300">
            {t("portfolio.analysis.partial")}
          </p>
        ) : null}
      </div>
    </section>
  )
}
