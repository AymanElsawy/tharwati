import { compareDecimals } from "@/lib/financial-calculations/decimal"

export function recordColor(type: string): string {
  return type === "income" || type === "refund"
    ? "text-[var(--color-success)]"
    : type === "expense"
      ? "text-[var(--color-danger)]"
      : ""
}

export function netColor(amount: string): string {
  const sign = compareDecimals(amount, "0")
  return sign === null || sign === 0
    ? "text-muted-foreground"
    : sign < 0
      ? "text-[var(--color-danger)]"
      : "text-[var(--color-success)]"
}
