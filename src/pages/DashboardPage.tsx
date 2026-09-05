import { Bell } from "lucide-react"
import { AssetsBreakdownCard } from "@/features/dashboard/components/AssetsBreakdownCard"
import { DashboardKeyInsights } from "@/features/dashboard/components/DashboardKeyInsights"
import { DashboardPortfolioAllocationCard } from "@/features/dashboard/components/DashboardPortfolioAllocationCard"
import { DashboardGoalsCard } from "@/features/dashboard/components/DashboardGoalsCard"
import { NetWorthCard } from "@/features/dashboard/components/NetWorthCard"
import { useDashboardAggregate } from "@/features/dashboard/hooks/useDashboardAggregate"
import { AuthenticatedUserHeader } from "@/features/profile/components/AuthenticatedUserHeader"
import { useCurrentUser } from "@/features/profile/hooks/useCurrentUser"
import { useTranslation } from "@/i18n/useTranslation"

export function DashboardPage() {
  const { t, language } = useTranslation()
  const { firstName } = useCurrentUser()
  const aggregate = useDashboardAggregate()
  const date = new Intl.DateTimeFormat(language === "ar" ? "ar-SA" : "en-US", {
    dateStyle: "full",
  }).format(new Date())

  return (
    <section className="tharwati-dashboard-page tharwati-page-stack">
      <header className="tharwati-dashboard-masthead flex items-start justify-between gap-4">
        <div>
          <p className="tharwati-dashboard-greeting">
            {t("dashboard.hero.personalGreeting", {
              name: firstName ?? t("dashboard.hero.guest"),
            })}
          </p>
          <h1 className="tharwati-dashboard-title mt-2">
            {t("pages.dashboard.title")}
          </h1>
          <p className="tharwati-dashboard-date mt-3 text-sm" dir="ltr">
            {date}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            aria-label={t("dashboard.hero.notifications")}
            className="tharwati-dashboard-bell flex size-11 items-center justify-center rounded-2xl"
          >
            <Bell size={20} />
          </span>
          <div className="flex size-11 items-center justify-center overflow-hidden rounded-full border border-white/40 bg-black/20 shadow-[0_8px_28px_rgba(0,0,0,0.22)] backdrop-blur-xl">
            <AuthenticatedUserHeader compact />
          </div>
        </div>
      </header>

      <div className="grid gap-8 sm:gap-[var(--space-section)]">
        <NetWorthCard {...aggregate} />
        <div className="grid gap-6 xl:grid-cols-2">
          <AssetsBreakdownCard
            aggregate={aggregate.result}
            isLoading={aggregate.isLoading}
          />
          <DashboardKeyInsights
            aggregate={aggregate.result}
            isLoading={aggregate.isLoading}
          />
        </div>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start">
          <DashboardPortfolioAllocationCard
            allocation={aggregate.portfolioAllocation}
            baseCurrencyCode={aggregate.result?.baseCurrencyCode ?? null}
            isLoading={aggregate.isLoading}
          />
          <DashboardGoalsCard />
        </div>
      </div>
    </section>
  )
}
