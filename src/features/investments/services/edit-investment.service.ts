import { accountsRepository } from "@/features/accounts/repositories/accounts.repository"
import { assetsRepository } from "@/features/assets/repositories/assets.repository"
import type { Decimal } from "@/lib/supabase/types"
import type { Database } from "@/lib/supabase/types"
import { investmentsRepository } from "../repositories/investments.repository"
import type { EditInvestmentResult, EditInvestmentValues } from "../types/edit-investment"

export function requireInvestmentDecimal(value: unknown, field: string): Decimal {
  if (typeof value !== "string" || !/^-?\d+(?:\.\d+)?$/.test(value)) {
    throw new TypeError(`${field} must be an exact PostgreSQL decimal string`)
  }
  return value
}

export async function loadEditableInvestment(transactionId: string): Promise<EditInvestmentValues> {
  const record = await investmentsRepository.getInvestment(transactionId)
  const assetEntry = record.transaction_entries.find((entry) => entry.memo === "investment_asset")
  const feeEntry = record.transaction_entries.find((entry) => entry.memo === "investment_fee")
  if (!assetEntry?.asset_id || assetEntry.quantity_delta == null || assetEntry.unit_price == null) {
    throw new Error("The investment does not have the supported immutable Buy ledger shape.")
  }
  const [account, asset] = await Promise.all([
    accountsRepository.getAccount(assetEntry.account_id),
    assetsRepository.getAsset(assetEntry.asset_id),
  ])
  return {
    transactionId: record.id,
    accountId: account.id,
    accountName: account.name,
    assetId: asset.id,
    assetName: asset.name,
    quantity: requireInvestmentDecimal(assetEntry.quantity_delta, "investment quantity"),
    unitPrice: requireInvestmentDecimal(assetEntry.unit_price, "investment unit price"),
    fees: feeEntry ? requireInvestmentDecimal(feeEntry.transaction_amount, "investment fees") : "0",
    occurredAt: record.occurred_at.slice(0, 10),
    notes: record.notes ?? "",
  }
}

export async function editInvestment(values: EditInvestmentValues): Promise<EditInvestmentResult> {
  const result = await investmentsRepository.editInvestment(buildEditInvestmentArgs(values))
  window.dispatchEvent(new CustomEvent("tharwati:data-changed"))
  return result
}

export function buildEditInvestmentArgs(values: EditInvestmentValues): Database["public"]["Functions"]["edit_investment"]["Args"] {
  return {
    p_transaction_id: values.transactionId,
    p_quantity: values.quantity,
    p_unit_price: values.unitPrice,
    p_fees: values.fees,
    p_occurred_at: new Date(`${values.occurredAt}T12:00:00`).toISOString(),
    p_notes: values.notes.trim() || null,
  }
}
