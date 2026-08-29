import { formatPortfolioDecimal } from "@/features/portfolio/utils/portfolio-formatters"
import type { Decimal } from "@/lib/supabase/types"

export function formatGoalMoney(
  value: Decimal | null,
  currencyCode: string,
  locale: string,
  sign?: "+" | "−"
) {
  return `${sign ?? ""}${formatPortfolioDecimal(value, locale, 2)} ${currencyCode}`
}
