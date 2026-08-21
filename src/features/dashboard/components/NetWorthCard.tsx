import { AlertTriangle, RefreshCw, WalletCards } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { AnimatedNetWorthValue } from "@/features/dashboard/components/AnimatedNetWorthValue"
import { getAccountTypeLabel } from "@/features/accounts/types/account-form"
import { useNetWorth } from "@/features/dashboard/hooks/useNetWorth"
import { useTranslation } from "@/i18n/useTranslation"

function formatAmount(value: number) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function NetWorthCard() {
  const { t } = useTranslation()
  const { error, isLoading, refresh, result } = useNetWorth()

  if (isLoading) {
    return (
      <article aria-label="Loading net worth" className="tharwati-card min-h-48 animate-pulse p-6">
        <div className="h-4 w-24 rounded bg-[var(--color-surface-hover)]" />
        <div className="mt-7 h-9 w-48 rounded bg-[var(--color-surface-hover)]" />
        <div className="mt-5 h-4 w-36 rounded bg-[var(--color-surface-hover)]" />
      </article>
    )
  }

  if (error) {
    return (
      <article className="tharwati-card min-h-48 p-6">
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
      <article className="tharwati-card min-h-48 p-6">
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
    <article className="tharwati-card relative min-h-48 overflow-hidden p-6">
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
          <AnimatedNetWorthValue value={result.total} format={formatAmount} /> {result.baseCurrencyCode}
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

        {result.unavailablePairs.length > 0 ? (
          <p className="mt-3 text-sm text-amber-800 dark:text-amber-300">
            {t("dashboard.netWorth.unavailableRates", {
              pairs: result.unavailablePairs.join(", "),
            })}
          </p>
        ) : null}

        {result.skippedTypes.length > 0 ? (
          <p className="mt-3 text-xs text-[var(--color-text-muted)]">
            {t("dashboard.netWorth.skippedTypes", {
              types: result.skippedTypes
                .map((typeCode) => getAccountTypeLabel(typeCode, t))
                .join(", "),
            })}
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
