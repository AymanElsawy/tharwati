import { AccountsOverviewCard } from "@/features/dashboard/components/AccountsOverviewCard"
import { AssetsBreakdownCard } from "@/features/dashboard/components/AssetsBreakdownCard"
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
      <AssetsBreakdownCard aggregate={aggregate.result} isLoading={aggregate.isLoading} />
      <AccountsOverviewCard />
    </section>
  )
}
