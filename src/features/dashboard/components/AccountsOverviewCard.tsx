import { Coins } from "lucide-react"
import { Link } from "react-router-dom"

import { getAccountTypeLabel } from "@/features/accounts/types/account-form"
import { accountTypeVisuals } from "@/features/accounts/types/account-visuals"
import {
  dashboardAccountsOverviewRoute,
  type DashboardAccountsOverviewItem,
} from "@/features/dashboard/utils/accounts-overview"
import { formatPortfolioAmount } from "@/features/portfolio/utils/portfolio-formatters"
import { useTranslation } from "@/i18n/useTranslation"
import type { RepositoryError } from "@/lib/supabase/types"

const metalVisuals = {
  gold: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
  silver: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
} as const

function OverviewCard({ item, baseCurrencyCode }: {
  item: DashboardAccountsOverviewItem
  baseCurrencyCode: string
}) {
  const { t, language } = useTranslation()
  const isMetal = item.group === "gold" || item.group === "silver"
  const visual = isMetal
    ? null
    : accountTypeVisuals[item.group as Exclude<DashboardAccountsOverviewItem["group"], "gold" | "silver">]
  const metalVisual = item.group === "gold" ? metalVisuals.gold : item.group === "silver" ? metalVisuals.silver : null
  const Icon = visual?.icon ?? Coins
  const title = isMetal
    ? t(item.group === "gold" ? "accounts.form.metalType.gold" : "accounts.form.metalType.silver")
    : getAccountTypeLabel(item.group, t)

  return (
    <Link to={dashboardAccountsOverviewRoute(item.group)} className="tharwati-card flex min-h-36 flex-col gap-4 p-5 transition hover:opacity-90">
      <div className="flex items-center gap-3">
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${isMetal ? metalVisual! : visual!.iconWrap}`}>
          <Icon size={18} />
        </span>
        <div>
          <p className="font-semibold text-[var(--color-text-primary)]">{title}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">{t("dashboard.accountsOverview.accountCount", { count: item.accountCount })}</p>
        </div>
      </div>
      <div className="border-t border-[var(--border-quiet)] pt-3">
        <p className="text-xs font-medium text-[var(--color-text-secondary)]">{t("dashboard.accountsOverview.totalCurrentValue")}</p>
        <p className="mt-1 text-lg font-black tabular-nums" dir="ltr">
          {item.totalCurrentValueBase === null
            ? t("dashboard.accountsOverview.currentValueUnavailable")
            : formatPortfolioAmount(item.totalCurrentValueBase, baseCurrencyCode, language === "ar" ? "ar-SA" : "en-US")}
        </p>
      </div>
    </Link>
  )
}

export function AccountsOverviewCard({
  overview,
  baseCurrencyCode,
  error,
  isLoading,
}: {
  overview: readonly DashboardAccountsOverviewItem[]
  baseCurrencyCode: string | null
  error: RepositoryError | null
  isLoading: boolean
}) {
  const { t } = useTranslation()

  return (
    <section aria-labelledby="accounts-overview-title">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="accounts-overview-title" className="tharwati-section-title">{t("dashboard.accountsOverview.title")}</h2>
          <p className="tharwati-section-description">{t("dashboard.accountsOverview.description")}</p>
        </div>
        <Link to="/accounts" className="text-sm font-semibold text-[var(--color-primary)] hover:underline">{t("navigation.accounts")}</Link>
      </div>

      {isLoading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-2xl bg-[var(--color-surface-muted)]" />)}</div>
        : error || !baseCurrencyCode ? <p className="text-sm font-semibold text-red-600">{error?.message ?? t("dashboard.accountsOverview.currentValueUnavailable")}</p>
          : overview.length === 0 ? <div className="tharwati-surface flex min-h-32 items-center justify-center p-6 text-center"><p className="text-sm text-[var(--color-text-secondary)]">{t("dashboard.accountsOverview.empty")}</p></div>
            : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{overview.map((item) => <OverviewCard key={item.group} item={item} baseCurrencyCode={baseCurrencyCode} />)}</div>}
    </section>
  )
}
