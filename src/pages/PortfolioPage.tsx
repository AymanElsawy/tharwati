import { AlertTriangle } from "lucide-react"

import { PortfolioAttentionSummary } from "@/features/portfolio/components/PortfolioAttentionSummary"
import { PortfolioAllocationExplorer } from "@/features/portfolio/components/PortfolioAllocationExplorer"
import { PortfolioAnalysisContextBar } from "@/features/portfolio/components/PortfolioAnalysisContextBar"
import { PortfolioDiversificationAnalysis } from "@/features/portfolio/components/PortfolioDiversificationAnalysis"
import { PortfolioExecutiveError } from "@/features/portfolio/components/PortfolioExecutiveError"
import { PortfolioExecutiveSkeleton } from "@/features/portfolio/components/PortfolioExecutiveSkeleton"
import { PortfolioHeader } from "@/features/portfolio/components/PortfolioHeader"
import { PortfolioHealth } from "@/features/portfolio/components/PortfolioHealth"
import { PortfolioRecommendedActions } from "@/features/portfolio/components/PortfolioRecommendedActions"
import { PortfolioRiskConcentration } from "@/features/portfolio/components/PortfolioRiskConcentration"
import { PortfolioValuePerformance } from "@/features/portfolio/components/PortfolioValuePerformance"
import { PortfolioHoldingsEvidence } from "@/features/portfolio/components/PortfolioHoldingsEvidence"
import { PortfolioHoldingDetail } from "@/features/portfolio/components/PortfolioHoldingDetail"
import { PortfolioCustodyBreakdown } from "@/features/portfolio/components/PortfolioCustodyBreakdown"
import { PortfolioActivity } from "@/features/portfolio/components/PortfolioActivity"
import { usePortfolioExecutive } from "@/features/portfolio/hooks/usePortfolioExecutive"
import { useTranslation } from "@/i18n/useTranslation"

export function PortfolioPage() {
  const {
    portfolio,
    error,
    isLoading,
    isUpdating,
    setActiveScopeId,
    refresh,
    analysis,
    evidence,
  } = usePortfolioExecutive()
  const { t } = useTranslation()

  if (isLoading && portfolio === null) {
    return <PortfolioExecutiveSkeleton />
  }

  if (portfolio === null) {
    return (
      <PortfolioExecutiveError
        error={error ?? new Error(t("portfolio.error.description"))}
        onRetry={() => void refresh()}
      />
    )
  }

  return (
    <div className="pb-10">
      {error ? (
        <div
          role="alert"
          className="mb-5 flex flex-wrap items-center justify-between gap-3 border-y border-amber-600/35 py-3 text-sm text-amber-800 dark:text-amber-300"
        >
          <span className="flex items-center gap-2">
            <AlertTriangle size={16} aria-hidden="true" />
            {t("portfolio.error.update")}
          </span>
          <button
            type="button"
            onClick={() => void refresh()}
            className="font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            {t("portfolio.error.retry")}
          </button>
        </div>
      ) : null}

      <div
        className={`transition-opacity duration-150 motion-reduce:transition-none ${
          isUpdating ? "opacity-60" : "opacity-100"
        }`}
        aria-busy={isUpdating}
      >
        <span className="sr-only" role="status" aria-live="polite">
          {isUpdating ? t("portfolio.header.updating") : ""}
        </span>
        <PortfolioHeader
          portfolio={portfolio}
          isUpdating={isUpdating}
          onScopeChange={setActiveScopeId}
        />

        <div className="mt-7 grid gap-7 sm:mt-8 sm:gap-8">
          <PortfolioValuePerformance portfolio={portfolio} />
          <PortfolioHealth
            portfolio={portfolio}
            highlightedFactorId={analysis.highlightedHealthFactor}
          />
          <PortfolioAttentionSummary insights={portfolio.insights} />
          <PortfolioRecommendedActions
            insights={portfolio.insights}
          />
        </div>

        <div className="mt-16 border-t border-[var(--border-subtle)] pt-12 sm:mt-20 sm:pt-16">
          <PortfolioAnalysisContextBar
            selection={analysis.selection}
            onClearAssetClass={() => analysis.selectAssetClass(null)}
            onClearExposure={() => analysis.selectExposure(null)}
          />
          <div className="mt-8 grid gap-16 sm:gap-20">
            <PortfolioAllocationExplorer
              exposures={portfolio.analysis.allocation}
              selectedId={analysis.selection.assetClassId}
              baseCurrency={portfolio.baseCurrency}
              isPartial={portfolio.analysis.isPartial}
              onSelect={analysis.selectAssetClass}
            />
            {analysis.activeDimension ? (
              <PortfolioDiversificationAnalysis
                dimension={analysis.activeDimension}
                selectedAssetClassId={
                  analysis.selection.assetClassId
                }
                selectedExposureId={analysis.selection.exposureId}
                baseCurrency={portfolio.baseCurrency}
                onDimensionChange={analysis.selectDimension}
                onExposureChange={analysis.selectExposure}
              />
            ) : null}
            <PortfolioRiskConcentration
              risks={analysis.risks}
              holdings={portfolio.analysis.holdings}
              selectedRiskId={analysis.selection.riskId}
              onSelect={analysis.selectRisk}
            />
          </div>
        </div>

        <div className="mt-16 grid gap-16 sm:mt-20 sm:gap-20">
          <PortfolioHoldingsEvidence
            holdings={evidence.holdings}
            allCount={portfolio.evidence.holdings.length}
            scopes={portfolio.scopeOptions}
            baseCurrency={portfolio.baseCurrency}
            filters={{
              search: evidence.filters.holdingSearch,
              accountId: evidence.filters.holdingAccountId,
              assetClass: evidence.filters.holdingAssetClass,
              sort: evidence.filters.holdingSort,
              direction: evidence.filters.holdingSortDirection,
              hasInherited: evidence.filters.hasInherited,
            }}
            onSearch={evidence.setHoldingSearch}
            onAccount={evidence.setHoldingAccountId}
            onAssetClass={evidence.setHoldingAssetClass}
            onSort={evidence.toggleHoldingSort}
            onOpen={evidence.setHoldingDetailId}
          />
          <PortfolioCustodyBreakdown
            accounts={evidence.custody}
            baseCurrency={portfolio.baseCurrency}
            activeScopeId={portfolio.activeScopeId}
            onSelect={setActiveScopeId}
          />
          <PortfolioActivity
            items={evidence.activity}
            allItems={portfolio.evidence.activity}
            scopes={portfolio.scopeOptions}
            type={evidence.filters.activityType}
            accountId={evidence.filters.activityAccountId}
            onType={evidence.setActivityType}
            onAccount={evidence.setActivityAccountId}
            selectedId={evidence.transactionDetailId}
            onSelectedId={evidence.setTransactionDetailId}
          />
        </div>
      </div>
      <PortfolioHoldingDetail
        holding={
          portfolio.evidence.holdings.find(
            (holding) => holding.id === evidence.holdingDetailId,
          ) ?? null
        }
        open={evidence.holdingDetailId !== null}
        onOpenChange={(open) => {
          if (!open) evidence.setHoldingDetailId(null)
        }}
        baseCurrency={portfolio.baseCurrency}
      />
    </div>
  )
}
