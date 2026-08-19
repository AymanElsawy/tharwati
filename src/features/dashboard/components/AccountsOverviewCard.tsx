import { Coins, Minus, TrendingDown, TrendingUp } from "lucide-react"
import type { ReactNode } from "react"
import { Link } from "react-router-dom"

import { getAccountTypeLabel } from "@/features/accounts/types/account-form"
import { accountTypeVisuals } from "@/features/accounts/types/account-visuals"
import type {
  AccountTypeOverview,
  MetalOverview,
} from "@/features/dashboard/hooks/useAccountsOverview"
import { useAccountsOverview } from "@/features/dashboard/hooks/useAccountsOverview"
import { useTranslation } from "@/i18n/useTranslation"
import {
  compareDecimals,
  divideDecimals,
  multiplyDecimals,
  subtractDecimals,
} from "@/lib/financial-calculations/decimal"
import type { Decimal } from "@/lib/supabase/types"

function formatAmount(value: string) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value))
}

const metalVisuals = {
  gold: {
    iconWrap: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
  },
  silver: {
    iconWrap: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
} as const

function CardShell({
  to,
  iconWrap,
  title,
  subtitle,
  children,
}: {
  to: string
  iconWrap: string
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <Link to={to} className="tharwati-card flex flex-col gap-4 p-5 transition hover:opacity-90">
      <div className="flex items-center gap-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${iconWrap}`}
        >
          <Coins size={18} />
        </span>
        <div>
          <p className="font-semibold text-[var(--color-text-primary)]">{title}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">{subtitle}</p>
        </div>
      </div>
      <div className="border-t border-[var(--border-quiet)] pt-3">{children}</div>
    </Link>
  )
}

function TypeCard({ overview }: { overview: AccountTypeOverview }) {
  const { t } = useTranslation()
  const visual = accountTypeVisuals[overview.accountTypeCode]
  const Icon = visual.icon

  return (
    <article className="tharwati-card flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${visual.iconWrap}`}
          >
            <Icon size={18} />
          </span>
          <div>
            <p className="font-semibold text-[var(--color-text-primary)]">
              {getAccountTypeLabel(overview.accountTypeCode, t)}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {t("dashboard.accountsOverview.accountCount", {
                count: overview.accountCount,
              })}
            </p>
          </div>
        </div>
      </div>
      <div className="divide-y divide-[var(--border-quiet)] border-t border-[var(--border-quiet)]">
        {overview.currencyTotals.map((entry) => (
          <p key={entry.currencyCode} className="py-3 text-lg font-black first:pt-3" dir="ltr">
            {formatAmount(entry.total)} {entry.currencyCode}
          </p>
        ))}
      </div>
    </article>
  )
}

function ValueChangeIndicator({
  current,
  costBasis,
}: {
  current: Decimal
  costBasis: Decimal
}) {
  const { t } = useTranslation()
  const comparison = compareDecimals(current, costBasis)
  if (comparison === null) return null

  if (comparison === 0) {
    return (
      <span className="inline-flex items-center text-[var(--color-text-secondary)]">
        <Minus size={14} />
      </span>
    )
  }

  const isUp = comparison > 0
  const Icon = isUp ? TrendingUp : TrendingDown
  const hasCostBasis = compareDecimals(costBasis, "0") === 1
  const gainLoss = subtractDecimals(current, costBasis)
  const returnPercent =
    hasCostBasis && gainLoss !== null
      ? divideDecimals(multiplyDecimals(gainLoss, "100") ?? "0", costBasis, 2)
      : null

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold ${
        isUp ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
      }`}
      dir="ltr"
      title={t(
        isUp
          ? "dashboard.accountsOverview.valueIncreased"
          : "dashboard.accountsOverview.valueDecreased",
      )}
    >
      <Icon size={14} />
      {returnPercent !== null ? `${isUp ? "+" : ""}${formatAmount(returnPercent)}%` : null}
    </span>
  )
}

function MetalCard({ overview }: { overview: MetalOverview }) {
  const { t } = useTranslation()
  const visual = metalVisuals[overview.metalType]

  return (
    <CardShell
      to={`/accounts?type=gold&metal=${overview.metalType}`}
      iconWrap={visual.iconWrap}
      title={t(
        overview.metalType === "silver"
          ? "accounts.form.metalType.silver"
          : "accounts.form.metalType.gold",
      )}
      subtitle={t("dashboard.accountsOverview.accountCount", {
        count: overview.accountCount,
      })}
    >
      <div className="flex items-center justify-between gap-2 py-3 first:pt-3">
        <p className="text-lg font-black" dir="ltr">
          {overview.totalValueBase === null
            ? t("dashboard.accountsOverview.currentPriceUnavailable")
            : `${formatAmount(overview.totalValueBase)} ${overview.baseCurrencyCode}`}
        </p>
        {overview.totalValueBase !== null && overview.costBasisBase !== null ? (
          <ValueChangeIndicator
            current={overview.totalValueBase}
            costBasis={overview.costBasisBase}
          />
        ) : null}
      </div>
    </CardShell>
  )
}

export function AccountsOverviewCard() {
  const { t } = useTranslation()
  const { overview, error, isLoading } = useAccountsOverview()

  return (
    <section aria-labelledby="accounts-overview-title">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="accounts-overview-title" className="tharwati-section-title">
            {t("dashboard.accountsOverview.title")}
          </h2>
          <p className="tharwati-section-description">
            {t("dashboard.accountsOverview.description")}
          </p>
        </div>
        <Link
          to="/accounts"
          className="text-sm font-semibold text-[var(--color-primary)] hover:underline"
        >
          {t("navigation.accounts")}
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="h-32 animate-pulse rounded-2xl bg-[var(--color-surface-muted)]"
            />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm font-semibold text-red-600">
          {error.message}
        </p>
      ) : overview.length === 0 ? (
        <div className="tharwati-surface flex min-h-32 items-center justify-center p-6 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("dashboard.accountsOverview.empty")}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {overview.map((item) =>
            item.kind === "metal" ? (
              <MetalCard key={item.metalType} overview={item} />
            ) : (
              <TypeCard key={item.accountTypeCode} overview={item} />
            ),
          )}
        </div>
      )}
    </section>
  )
}
