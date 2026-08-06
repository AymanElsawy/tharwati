import { parseDecimal } from "@/lib/financial-calculations/decimal"
import type { Decimal } from "@/lib/supabase/types"

function localeSymbols(locale: string) {
  const parts = new Intl.NumberFormat(locale).formatToParts(1000.1)
  return {
    group: parts.find((part) => part.type === "group")?.value ?? ",",
    decimal: parts.find((part) => part.type === "decimal")?.value ?? ".",
  }
}

function localizedDigits(value: string, locale: string) {
  const digits = Array.from({ length: 10 }, (_, digit) =>
    new Intl.NumberFormat(locale, { useGrouping: false }).format(digit),
  )
  return value.replace(/\d/g, (digit) => digits[Number(digit)])
}

export function formatPortfolioDecimal(
  value: Decimal | null,
  locale: string,
  maximumFractionDigits = 2,
): string {
  if (value === null) return "—"
  const parsed = parseDecimal(value)
  if (!parsed) return "—"

  const isNegative = parsed.coefficient < 0n
  let absolute =
    parsed.coefficient < 0n ? -parsed.coefficient : parsed.coefficient
  let scale = parsed.scale
  if (scale > maximumFractionDigits) {
    const divisor = 10n ** BigInt(scale - maximumFractionDigits)
    absolute = (absolute + divisor / 2n) / divisor
    scale = maximumFractionDigits
  }
  const rawDigits = absolute.toString().padStart(scale + 1, "0")
  const integer =
    scale === 0 ? rawDigits : rawDigits.slice(0, -scale)
  const fraction =
    scale === 0 ? "" : rawDigits.slice(-scale)
  const roundedFraction = fraction
    .slice(0, maximumFractionDigits)
    .replace(/0+$/, "")
  const { group, decimal } = localeSymbols(locale)
  const groupedInteger = integer.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    group,
  )
  const formatted = `${isNegative ? "-" : ""}${groupedInteger}${
    roundedFraction ? `${decimal}${roundedFraction}` : ""
  }`
  return localizedDigits(formatted, locale)
}

export function formatPortfolioAmount(
  value: Decimal | null,
  currencyCode: string,
  locale: string,
): string {
  return `${currencyCode} ${formatPortfolioDecimal(value, locale, 2)}`
}

export function formatPortfolioPercent(
  value: Decimal | null,
  locale: string,
): string {
  return `${formatPortfolioDecimal(value, locale, 2)}%`
}
