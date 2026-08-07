import { AlertTriangle, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DashboardEmptyState } from "@/features/dashboard/components/DashboardEmptyState"
import { DashboardSummary } from "@/features/dashboard/components/DashboardSummary"
import { MissingDataCards } from "@/features/dashboard/components/MissingDataCards"
import { PerformanceCard } from "@/features/dashboard/components/PerformanceCard"
import { PortfolioAllocationCard } from "@/features/dashboard/components/PortfolioAllocationCard"
import { RecentActivityCard } from "@/features/dashboard/components/RecentActivityCard"
import { useDashboard } from "@/features/dashboard/hooks/useDashboard"
import { useTranslation } from "@/i18n/useTranslation"

export function DashboardPage() {
  const { t } = useTranslation()
  const { dashboard, error, isLoading, refresh } = useDashboard()

  return (
    <section className="tharwati-page-stack">
      <header className="tharwati-page-header">
        <p className="tharwati-eyebrow">
          {t("pages.dashboard.eyebrow")}
        </p>
        <h1 className="tharwati-page-title mt-2">
          {t("pages.dashboard.title")}
        </h1>
        <p className="tharwati-page-description">
          {t("pages.dashboard.description")}
        </p>
      </header>

      {isLoading ? (
        <div className="tharwati-metric-grid">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="h-44 animate-pulse border-e border-[var(--border-quiet)] bg-[var(--color-surface)] last:border-e-0"
            />
          ))}
        </div>
      ) : null}

      {!isLoading && error ? (
        <div role="alert" className="tharwati-surface p-8">
          <div className="flex items-center gap-3 text-red-700">
            <AlertTriangle className="size-5" />
            <h2 className="font-bold">Dashboard unavailable</h2>
          </div>
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
            {error.message}
          </p>
          <Button
            className="mt-5"
            variant="outline"
            onClick={() => void refresh()}
          >
            <RefreshCw /> Try Again
          </Button>
        </div>
      ) : null}

      {!isLoading && !error && dashboard?.isEmpty ? (
        <DashboardEmptyState />
      ) : null}

      {!isLoading && !error && dashboard && !dashboard.isEmpty ? (
        <>
          <MissingDataCards missing={dashboard.missingData} onRetry={() => void refresh()} />
          <DashboardSummary dashboard={dashboard} />
          <div className="grid gap-8 xl:grid-cols-[1.45fr_1fr]">
            <PerformanceCard
              performance={dashboard.performance}
              currency={dashboard.baseCurrency}
            />
            <PortfolioAllocationCard
              allocation={dashboard.allocation}
            />
          </div>
          <RecentActivityCard activities={dashboard.activities} />
        </>
      ) : null}
    </section>
  )
}
