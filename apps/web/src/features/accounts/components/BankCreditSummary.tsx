import { CreditCard } from "lucide-react"

import { formatPortfolioAmount } from "@/features/portfolio/utils/portfolio-formatters"
import type { Decimal } from "@/lib/supabase/types"
import { useTranslation } from "@/i18n/useTranslation"
import { getBankCreditSummary } from "../utils/bank-credit-summary"

export function BankCreditSummary({ creditCardLimit, currentBalance, dueDayOfMonth, currencyCode, locale, isLoading }: {
  creditCardLimit: Decimal | null
  currentBalance: Decimal | null
  dueDayOfMonth: number | null
  currencyCode: string
  locale: string
  isLoading: boolean
}) {
  const { t } = useTranslation()
  if (isLoading) return <div className="mt-4 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4"><div className="h-16 animate-pulse rounded-xl bg-muted" /><div className="h-16 animate-pulse rounded-xl bg-muted" /><div className="h-16 animate-pulse rounded-xl bg-muted" /><div className="h-16 animate-pulse rounded-xl bg-muted" /></div>
  const summary = getBankCreditSummary({ creditCardLimit, currentBalance, dueDayOfMonth })
  if (!summary) return <p className="mt-4 text-sm font-medium text-amber-800 dark:text-amber-300">{t("accounts.creditSummary.unavailable")}</p>
  const value = (amount: Decimal) => formatPortfolioAmount(amount, currencyCode, locale)
  return <section className="mt-5 max-w-2xl" aria-label={t("accounts.creditSummary.title")}><div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]"><CreditCard className="size-4 text-[var(--color-primary)]" />{t("accounts.creditSummary.title")}</div><dl className="grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3"><dt className="text-xs text-[var(--color-text-secondary)]">{t("accounts.creditSummary.creditLimit")}</dt><dd className="mt-1 text-sm font-semibold tabular-nums" dir="ltr">{value(summary.creditLimit)}</dd></div><div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3"><dt className="text-xs text-[var(--color-text-secondary)]">{t("accounts.creditSummary.availableCredit")}</dt><dd className="mt-1 text-sm font-semibold tabular-nums" dir="ltr">{value(summary.availableCredit)}</dd></div><div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3"><dt className="text-xs text-[var(--color-text-secondary)]">{t("accounts.creditSummary.amountDue")}</dt><dd className="mt-1 text-sm font-semibold tabular-nums" dir="ltr">{value(summary.amountDue)}</dd></div><div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3"><dt className="text-xs text-[var(--color-text-secondary)]">{t("accounts.creditSummary.dueDay")}</dt><dd className="mt-1 text-sm font-semibold">{summary.dueDayOfMonth === null ? t("accounts.creditSummary.dueDayUnset") : t("accounts.creditSummary.dueDayValue", { day: summary.dueDayOfMonth })}</dd></div></dl></section>
}
