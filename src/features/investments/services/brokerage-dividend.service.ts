import { subtractDecimals } from "@/lib/financial-calculations/decimal"

export function getBrokerageDividendPreview(gross: string, tax: string, fees: string) {
  const net = subtractDecimals(subtractDecimals(gross.trim() || "0", tax.trim() || "0") ?? "0", fees.trim() || "0")
  return { gross: gross.trim() || "0", tax: tax.trim() || "0", fees: fees.trim() || "0", net }
}
