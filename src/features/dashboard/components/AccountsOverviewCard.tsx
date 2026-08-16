import { Link } from "react-router-dom"

import { getAccountTypeLabel } from "@/features/accounts/types/account-form"
import { accountTypeVisuals } from "@/features/accounts/types/account-visuals"
import type { AccountTypeOverview } from "@/features/dashboard/hooks/useAccountsOverview"
import { useAccountsOverview } from "@/features/dashboard/hooks/useAccountsOverview"
import { useTranslation } from "@/i18n/useTranslation"

function formatAmount(value: string) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value))
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
        {overview.metalAccounts
          ? overview.metalAccounts.map((metalAccount) => (
              <div key={metalAccount.accountId} className="space-y-1 py-3 first:pt-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {metalAccount.name}
                  </p>
                  <span className="shrink-0 rounded-full bg-[var(--color-surface-muted)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                    {t(
                      metalAccount.metalType === "silver"
                        ? "accounts.form.metalType.silver"
                        : "accounts.form.metalType.gold",
                    )}
                  </span>
                </div>
                <p className="text-lg font-black" dir="ltr">
                  {t("dashboard.accountsOverview.metalUnits", {
                    units: formatAmount(metalAccount.units),
                  })}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]" dir="ltr">
                  {t("dashboard.accountsOverview.costPerUnit", {
                    price: formatAmount(metalAccount.costPerUnit),
                    currency: metalAccount.currencyCode,
                  })}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]" dir="ltr">
                  {metalAccount.currentPricePerUnit === null
                    ? t("dashboard.accountsOverview.currentPriceUnavailable")
                    : t("dashboard.accountsOverview.currentPricePerUnit", {
                        price: formatAmount(String(metalAccount.currentPricePerUnit)),
                        currency: metalAccount.currencyCode,
                      })}
                </p>
              </div>
            ))
          : overview.currencyTotals.map((entry) => (
              <p key={entry.currencyCode} className="py-3 text-lg font-black first:pt-3" dir="ltr">
                {formatAmount(entry.total)} {entry.currencyCode}
              </p>
            ))}
      </div>
    </article>
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
          {overview.map((item) => (
            <TypeCard key={item.accountTypeCode} overview={item} />
          ))}
        </div>
      )}
    </section>
  )
}
