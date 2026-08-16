import { AccountsOverviewCard } from "@/features/dashboard/components/AccountsOverviewCard"
import { NetWorthCard } from "@/features/dashboard/components/NetWorthCard"
import { useTranslation } from "@/i18n/useTranslation"

export function DashboardPage() {
  const { t } = useTranslation()

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

      <NetWorthCard />
      <AccountsOverviewCard />
    </section>
  )
}
