import { supabase } from "@/lib/supabase"
import { requireQueryData } from "@/lib/supabase/repository"
import { divideDecimals, multiplyDecimals, normalizeDecimal } from "@/lib/financial-calculations/decimal"
import type { Decimal } from "@/lib/supabase/types"
import type { AccountValuation, AccountValuationInput } from "../types/account-valuation"

function mapValuation(row: {
  id: string; account_id: string; valuation_amount: Decimal; valued_on: string
  valuation_method: string | null; notes: string | null; corrects_valuation_id: string | null; created_at: string
}): AccountValuation {
  if (normalizeDecimal(String(row.valuation_amount)) === null) throw new Error("Invalid account valuation amount")
  return { id: row.id, accountId: row.account_id, valuationAmount: String(row.valuation_amount), valuedOn: row.valued_on, valuationMethod: row.valuation_method, notes: row.notes, correctsValuationId: row.corrects_valuation_id, createdAt: row.created_at }
}

export async function getEffectiveAccountValuations(accountIds: readonly string[]) {
  if (accountIds.length === 0) return [] as AccountValuation[]
  const { data, error } = await supabase.rpc("get_effective_account_valuations", { p_account_ids: [...accountIds] })
  return requireQueryData(data, error, "accountValuations.getEffective").map(mapValuation)
}

export async function addAccountValuation(accountId: string, input: AccountValuationInput) {
  const { data, error } = await supabase.rpc("add_account_valuation", {
    p_account_id: accountId, p_valuation_amount: input.valuationAmount, p_valued_on: input.valuedOn,
    p_valuation_method: input.valuationMethod ?? null, p_notes: input.notes ?? null,
  })
  return mapValuation(requireQueryData(data, error, "accountValuations.add"))
}

export async function correctAccountValuation(valuationId: string, input: AccountValuationInput) {
  const { data, error } = await supabase.rpc("correct_account_valuation", {
    p_valuation_id: valuationId, p_valuation_amount: input.valuationAmount, p_valued_on: input.valuedOn,
    p_valuation_method: input.valuationMethod ?? null, p_notes: input.notes ?? null,
  })
  return mapValuation(requireQueryData(data, error, "accountValuations.correct"))
}

export function attributableValuation(valuation: AccountValuation | null, ownershipPercentage: Decimal | null): Decimal | null {
  if (!valuation || ownershipPercentage === null) return null
  const percentage = normalizeDecimal(ownershipPercentage)
  if (percentage === null) return null
  const product = multiplyDecimals(valuation.valuationAmount, percentage)
  return product === null ? null : divideDecimals(product, "100")
}
