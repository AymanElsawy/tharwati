import { normalizeDecimal } from "@/lib/financial-calculations/decimal"

const decimals = new Set([
  "p_balance_grams", "quantityGrams", "costPerUnit", "fees", "p_quantity_grams", "p_cost_per_unit", "p_fees",
  "p_quantity", "p_average_cost", "p_account_fx_rate", "p_valuation_amount",
  "valuationAmount", "p_opening_balance", "p_credit_card_limit", "p_ownership_percentage",
])

/** Fingerprint the effective command, before adding its attempt key. Never parse money as Number. */
export function createFingerprint(payload: object): string {
  return JSON.stringify(Object.entries(payload).sort(([a], [b]) => a.localeCompare(b)).map(([key, raw]) => {
    let value = typeof raw === "string" ? raw.trim() || null : raw ?? null
    if (typeof value === "string" && decimals.has(key)) value = normalizeDecimal(value)
    if (typeof value === "string" && ["purity", "p_purity"].includes(key)) value = value.toLowerCase()
    if (typeof value === "string" && ["p_valuation_method", "valuationMethod"].includes(key) && value.startsWith("other:")) value = "other:" + value.slice(6).trim()
    return [key, value]
  }))
}
