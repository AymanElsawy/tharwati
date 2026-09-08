import type { Decimal } from "@/lib/supabase/types"
import { formatGoalMoney } from "./goal-money"

export function GoalMoney({
  value,
  currencyCode,
  locale,
  sign,
  className,
}: {
  value: Decimal | null
  currencyCode: string
  locale: string
  sign?: "+" | "−"
  className?: string
}) {
  return (
    <span className={`whitespace-nowrap tabular-nums ${className ?? ""}`} dir="ltr">
      {formatGoalMoney(value, currencyCode, locale, sign)}
    </span>
  )
}
