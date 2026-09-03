import { AccountsOverviewCard } from "@/features/dashboard/components/AccountsOverviewCard"
import { AssetsBreakdownCard } from "@/features/dashboard/components/AssetsBreakdownCard"
import { DashboardPortfolioAllocationCard } from "@/features/dashboard/components/DashboardPortfolioAllocationCard"
import { DashboardGoalsCard } from "@/features/dashboard/components/DashboardGoalsCard"
import { NetWorthCard } from "@/features/dashboard/components/NetWorthCard"
import { useDashboardAggregate } from "@/features/dashboard/hooks/useDashboardAggregate"
import { useTranslation } from "@/i18n/useTranslation"

export function DashboardPage() {
  const { t } = useTranslation()
  const aggregate = useDashboardAggregate()

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

      <NetWorthCard {...aggregate} />
      <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
        <AssetsBreakdownCard aggregate={aggregate.result} isLoading={aggregate.isLoading} />
        <DashboardPortfolioAllocationCard
          allocation={aggregate.portfolioAllocation}
          baseCurrencyCode={aggregate.result?.baseCurrencyCode ?? null}
          isLoading={aggregate.isLoading}
        />
      </div>
      <AccountsOverviewCard
        overview={aggregate.accountsOverview}
        baseCurrencyCode={aggregate.result?.baseCurrencyCode ?? null}
        error={aggregate.error}
        isLoading={aggregate.isLoading}
      />
      <DashboardGoalsCard />
    </section>
  )
}
