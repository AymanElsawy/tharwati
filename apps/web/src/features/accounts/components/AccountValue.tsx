import { formatPortfolioAmount } from "@/features/portfolio/utils/portfolio-formatters"
import type { Decimal } from "@/lib/supabase/types"

/** Prominent, label-free account value presentation. Value resolution remains in the Accounts service layer. */
export function AccountValue({
  value,
  currencyCode,
  locale,
  isLoading = false,
}: {
  value: Decimal | null
  currencyCode: string
  locale: string
  isLoading?: boolean
}) {
  if (isLoading) return <div className="mt-4 h-9 w-44 animate-pulse rounded-lg bg-muted" aria-label="Loading account value" />
  return <p className="mt-4 text-3xl font-black tracking-tight text-[var(--color-text-primary)] tabular-nums" dir="ltr">{value === null ? "—" : formatPortfolioAmount(value, currencyCode, locale)}</p>
}
