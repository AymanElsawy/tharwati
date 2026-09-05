import { AlertTriangle, Landmark, RefreshCw, WalletCards } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { AnimatedNetWorthValue } from "@/features/dashboard/components/AnimatedNetWorthValue"
import type { DashboardAggregate } from "@/features/dashboard/services/dashboard-aggregate.service"
import { formatPortfolioAmount } from "@/features/portfolio/utils/portfolio-formatters"
import { useTranslation } from "@/i18n/useTranslation"
import type { RepositoryError } from "@/lib/supabase/types"

type NetWorthCardProps = {
  result: DashboardAggregate | null
  error: RepositoryError | null
  isLoading: boolean
  refresh: () => Promise<void>
}

function Metric({
  label,
  value,
  icon: Icon,
  className = "",
}: {
  label: string
  value: string
  icon: typeof Landmark
  className?: string
}) {
  return (
    <div
      className={`min-w-0 rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur-sm sm:p-4 dark:border-white/10 dark:bg-black/10 ${className}`}
    >
      <div className="flex items-center gap-1 text-[10px] font-bold tracking-[0.08em] text-[var(--color-text-secondary)] uppercase sm:gap-2 sm:text-xs sm:tracking-[0.12em]">
        <Icon size={15} />
        {label}
      </div>
      <p
        className="mt-2 overflow-hidden text-sm leading-tight font-black tracking-tight text-ellipsis whitespace-nowrap text-[var(--color-text-primary)] tabular-nums sm:mt-3 sm:text-lg"
        dir="ltr"
      >
        {value}
      </p>
    </div>
  )
}

export function NetWorthCard({
  result,
  error,
  isLoading,
  refresh,
}: NetWorthCardProps) {
  const { t } = useTranslation()
  const locale = "en-US"
  const unavailable = t("dashboard.netWorth.unavailable")
  if (isLoading)
    return (
      <article
        aria-label="Loading net worth"
        className="tharwati-dashboard-hero min-h-60 animate-pulse p-5 sm:min-h-72 sm:p-8"
      >
        <div className="h-4 w-32 rounded bg-[var(--color-surface-hover)]" />
        <div className="mt-6 h-14 w-72 rounded bg-[var(--color-surface-hover)]" />
        <div className="mt-5 grid grid-cols-2 gap-2 sm:mt-8 sm:grid-cols-3 sm:gap-3">
          <div className="h-24 rounded-2xl bg-[var(--color-surface-hover)]" />
          <div className="h-24 rounded-2xl bg-[var(--color-surface-hover)]" />
          <div className="h-24 rounded-2xl bg-[var(--color-surface-hover)]" />
        </div>
      </article>
    )
  if (error)
    return (
      <article className="tharwati-dashboard-hero p-5 sm:p-8">
        <div className="flex items-center gap-2 text-red-700">
          <AlertTriangle className="size-5" />
          <h2 className="font-bold">{unavailable}</h2>
        </div>
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          {error.message}
        </p>
        <Button
          className="mt-5"
          variant="outline"
          onClick={() => void refresh()}
        >
          <RefreshCw /> {t("accounts.actions.tryAgain")}
        </Button>
      </article>
    )
  if (!result)
    return (
      <article className="tharwati-dashboard-hero p-5 sm:p-8">
        <h2 className="text-sm font-bold tracking-[0.14em] text-[var(--color-primary)] uppercase">
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
  const complete = result.status === "complete" && result.netWorth !== null
  const money = (value: string | null) =>
    value === null
      ? unavailable
      : formatPortfolioAmount(value, result.baseCurrencyCode, locale)
  const netWorthValue = complete ? Number(result.netWorth) : null
  return (
    <article className="tharwati-dashboard-hero relative overflow-hidden p-5 sm:p-8">
      <div
        aria-hidden="true"
        className="absolute -end-16 -top-20 size-64 rounded-full bg-[var(--color-primary-soft)] blur-3xl"
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="tharwati-eyebrow">{t("dashboard.netWorth.title")}</p>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              {t("dashboard.netWorth.accountCount", {
                count: result.accountCount,
              })}
            </p>
          </div>
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-[var(--color-text-on-primary)]">
            <WalletCards size={21} />
          </span>
        </div>
        <p
          className="mt-4 text-4xl leading-none font-black tracking-tight break-words text-[var(--color-text-primary)] sm:mt-5 sm:text-6xl"
          dir="ltr"
        >
          {netWorthValue !== null && Number.isFinite(netWorthValue) ? (
            <AnimatedNetWorthValue
              value={netWorthValue}
              format={(value) =>
                formatPortfolioAmount(
                  String(value),
                  result.baseCurrencyCode,
                  locale
                )
              }
            />
          ) : (
            unavailable
          )}
        </p>
        {result.status === "incomplete" ? (
          <p className="mt-4 max-w-2xl text-sm text-amber-800 dark:text-amber-300">
            {result.unavailablePairs.length > 0
              ? t("dashboard.netWorth.unavailableRates", {
                  pairs: result.unavailablePairs.join(", "),
                })
              : t("dashboard.netWorth.incomplete")}
          </p>
        ) : null}
        <div className="mt-5 grid grid-cols-2 gap-2 sm:mt-8 sm:grid-cols-3 sm:gap-3">
          <Metric
            label={t("dashboard.assetsBreakdown.totalAssets")}
            value={money(result.totalAssets)}
            icon={Landmark}
            className="col-span-2 sm:col-span-1"
          />
          <Metric
            label={t("dashboard.assetsBreakdown.totalLiabilities")}
            value={money(result.totalLiabilities)}
            icon={Landmark}
          />
          <Metric
            label={t("dashboard.hero.accountsCount")}
            value={String(result.accountCount)}
            icon={WalletCards}
          />
        </div>
      </div>
    </article>
  )
}
