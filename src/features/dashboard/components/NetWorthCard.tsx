import { AlertTriangle, RefreshCw, WalletCards } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import type { DashboardAggregate } from "@/features/dashboard/services/dashboard-aggregate.service"
import { formatPortfolioAmount } from "@/features/portfolio/utils/portfolio-formatters"
import type { RepositoryError } from "@/lib/supabase/types"
import { useTranslation } from "@/i18n/useTranslation"

type NetWorthCardProps = {
  result: DashboardAggregate | null
  error: RepositoryError | null
  isLoading: boolean
  refresh: () => Promise<void>
}

export function NetWorthCard({ result, error, isLoading, refresh }: NetWorthCardProps) {
  const { t, language } = useTranslation()

  if (isLoading) {
    return (
      <article aria-label="Loading net worth" className="tharwati-card min-h-48 animate-pulse p-6 lg:min-h-0">
        <div className="h-4 w-24 rounded bg-[var(--color-surface-hover)]" />
        <div className="mt-7 h-9 w-48 rounded bg-[var(--color-surface-hover)]" />
        <div className="mt-5 h-4 w-36 rounded bg-[var(--color-surface-hover)]" />
      </article>
    )
  }

  if (error) {
    return (
      <article className="tharwati-card min-h-48 p-6 lg:min-h-0">
        <div className="flex items-center gap-2 text-red-700">
          <AlertTriangle className="size-5" />
          <h2 className="font-bold">{t("dashboard.netWorth.unavailable")}</h2>
        </div>
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">{error.message}</p>
        <Button className="mt-5" variant="outline" onClick={() => void refresh()}>
          <RefreshCw /> {t("accounts.actions.tryAgain")}
        </Button>
      </article>
    )
  }

  if (!result) {
    return (
      <article className="tharwati-card min-h-48 p-6 lg:min-h-0">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">
          {t("dashboard.netWorth.title")}
        </h2>
        <p className="mt-5 text-sm text-[var(--color-text-secondary)]">
          {t("dashboard.netWorth.noBaseCurrency")}
        </p>
        <Link to="/onboarding" className="tharwati-button-primary mt-5">
          {t("dashboard.netWorth.completeOnboarding")}
        </Link>
      </article>
    )
  }

  return (
    <article className="tharwati-card relative min-h-48 overflow-hidden p-6 lg:min-h-0">
      <div
        aria-hidden="true"
        className="absolute -end-8 -top-8 size-28 rounded-full bg-[var(--color-primary-soft)]"
      />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">
            {t("dashboard.netWorth.title")}
          </h2>
          <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <WalletCards className="size-5" />
          </span>
        </div>

        <p className="mt-5 text-3xl font-black tracking-tight text-[var(--color-text-primary)]" dir="ltr">
          {result.status === "complete" && result.netWorth !== null
            ? formatPortfolioAmount(result.netWorth, result.baseCurrencyCode, language === "ar" ? "ar-SA" : "en-US")
            : t("dashboard.netWorth.unavailable")}
        </p>

        {result.accountCount === 0 ? (
          <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
            {t("dashboard.netWorth.empty")}
          </p>
        ) : (
          <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
            {t("dashboard.netWorth.accountCount", { count: result.accountCount })}
          </p>
        )}

        {result.status === "incomplete" ? (
          <p className="mt-3 text-sm text-amber-800 dark:text-amber-300">
            {result.unavailablePairs.length > 0
              ? t("dashboard.netWorth.unavailableRates", { pairs: result.unavailablePairs.join(", ") })
              : t("dashboard.netWorth.incomplete")}
          </p>
        ) : null}
        <Link
          to="/accounts"
          className="mt-4 inline-flex text-sm font-semibold text-[var(--color-primary)] hover:underline"
        >
          {t("navigation.accounts")}
        </Link>
      </div>
    </article>
  )
}
