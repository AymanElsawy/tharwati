import { subtractDecimals, divideDecimals } from "@/lib/financial-calculations/decimal"

export function getBrokerageDividendPreview(gross: string, tax: string, fees: string) {
  const net = subtractDecimals(subtractDecimals(gross.trim() || "0", tax.trim() || "0") ?? "0", fees.trim() || "0")
  return { gross: gross.trim() || "0", tax: tax.trim() || "0", fees: fees.trim() || "0", net }
}
export function getBrokerageDividendReinvestmentPreview(gross:string,tax:string,fees:string,price:string) { const base=getBrokerageDividendPreview(gross,tax,fees); return { ...base, quantityAdded: base.net && price.trim() ? divideDecimals(base.net,price.trim()) : null } }
export function getBrokeragePartialDividendReinvestmentPreview(gross:string,tax:string,fees:string,reinvestedAmount:string,price:string) { const base=getBrokerageDividendPreview(gross,tax,fees); const reinvested=reinvestedAmount.trim()||"0"; const cashRemainder=base.net?subtractDecimals(base.net,reinvested):null; return { ...base, reinvestedAmount:reinvested, cashRemainder, quantityAdded: price.trim() ? divideDecimals(reinvested,price.trim()) : null } }
