import { Filter, X } from "lucide-react"

import type { PortfolioAnalyticalSelection } from "@/features/portfolio/types/portfolio-analysis"
import { portfolioAssetClassLabel } from "@/features/portfolio/utils/portfolio-labels"
import { useTranslation } from "@/i18n/useTranslation"

export function PortfolioAnalysisContextBar({
  selection,
  onClearAssetClass,
  onClearExposure,
}: {
  selection: PortfolioAnalyticalSelection
  onClearAssetClass: () => void
  onClearExposure: () => void
}) {
  const { t } = useTranslation()
  if (!selection.assetClassId && !selection.exposureId) return null

  return (
    <div
      aria-label={t("portfolio.filters.active")}
      className="flex flex-wrap items-center gap-2 border-y border-[var(--color-border)]/60 py-3 text-xs"
    >
      <span className="me-1 flex items-center gap-1.5 font-semibold text-[var(--color-text-secondary)]">
        <Filter size={14} aria-hidden="true" />
        {t("portfolio.filters.analytical")}
      </span>
      {selection.assetClassId ? (
        <button
          type="button"
          onClick={onClearAssetClass}
          className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3 py-1.5 font-semibold outline-none hover:bg-[var(--color-surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        >
          {t("portfolio.filters.assetClass")}:{" "}
          {portfolioAssetClassLabel(selection.assetClassId, t)}
          <X size={12} aria-hidden="true" />
        </button>
      ) : null}
      {selection.exposureId ? (
        <button
          type="button"
          onClick={onClearExposure}
          className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3 py-1.5 font-semibold outline-none hover:bg-[var(--color-surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        >
          {t("portfolio.filters.exposure")}: {selection.exposureId}
          <X size={12} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}
