import {
  formatPortfolioAmount,
  formatPortfolioPercent,
  formatPortfolioRoundedAmount,
} from "@/features/portfolio/utils/portfolio-formatters"
import type { Decimal } from "@/lib/supabase/types"

// Analysis uses the user's localized labels while keeping financial notation
// stable across LTR and RTL presentation.
const wealthAnalysisNumberLocale = "en-US"

export function formatWealthAnalysisAmount(
  value: Decimal | null,
  currencyCode: string
) {
  return formatPortfolioAmount(value, currencyCode, wealthAnalysisNumberLocale)
}

export function formatWealthAnalysisRoundedAmount(
  value: Decimal | null,
  currencyCode: string
) {
  return formatPortfolioRoundedAmount(
    value,
    currencyCode,
    wealthAnalysisNumberLocale
  )
}

export function formatWealthAnalysisPercent(value: Decimal | null) {
  return formatPortfolioPercent(value, wealthAnalysisNumberLocale)
}

export function normalizeWealthAnalysisDecimalInput(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, ".")
}
