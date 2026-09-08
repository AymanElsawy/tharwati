import type { QuantityUnit } from "../../../lib/supabase/types"

export function formatCostAmount(
  value: string | null,
  currencyCode: string,
  locale: string,
): string {
  if (value === null) return "—"
  const amount = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value))
  return `${currencyCode} ${amount}`
}

function quantityPrecision(unit: QuantityUnit): number {
  if (unit === "coins") return 8
  if (unit === "currency_amount") return 2
  if (
    unit === "grams" ||
    unit === "kilograms" ||
    unit === "troy_ounces"
  ) {
    return 4
  }
  if (unit === "shares") return 6
  return 4
}

export function formatHoldingQuantity(
  value: string,
  unit: QuantityUnit,
  locale: string,
): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: quantityPrecision(unit),
  }).format(Number(value))
}

