import { supabase, type TypedSupabaseClient } from "@/lib/supabase/client"
import {
  requireAuthenticatedUserId,
  requireQueryData,
} from "@/lib/supabase/repository"
import { normalizeDecimal } from "@/lib/financial-calculations/decimal"
import {
  RepositoryError,
  type Decimal,
  type MetalPurchaseRecord,
} from "@/lib/supabase/types"
import type { AddMetalPurchaseCommand } from "../types/metal-purchase"

export type MetalPurchaseLedgerRow = {
  id: string
  occurred_at: string
  created_at: string
  transaction_currency_code: string
  purchase_entries: Array<{
    account_id: string
    purity: string
    quantity_delta: Decimal
    unit_price: Decimal
    transaction_amount: Decimal
  }>
  transaction_entries: Array<{
    account_id: string | null
    memo: string | null
  }>
}

export type MetalPurchaseHistoryRow = MetalPurchaseRecord

function requireDecimalText(value: unknown, field: string): Decimal {
  const decimal = typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : value

  if (typeof decimal !== "string" || normalizeDecimal(decimal) === null) {
    throw new RepositoryError({
      code: "database_error",
      message: `Metal purchase field ${field} must be a PostgreSQL decimal string`,
      operation: "metalPurchases.getPurchases",
    })
  }
  return decimal
}

export function mapMetalPurchaseHistoryRow(
  row: MetalPurchaseRecord
): MetalPurchaseHistoryRow {
  return {
    ...row,
    quantity_grams: requireDecimalText(row.quantity_grams, "quantity_grams"),
    cost_per_unit: requireDecimalText(row.cost_per_unit, "cost_per_unit"),
    fees: requireDecimalText(row.fees, "fees"),
  }
}

export class MetalPurchasesRepository {
  private readonly client: TypedSupabaseClient

  constructor(client: TypedSupabaseClient = supabase) {
    this.client = client
  }

  async addPurchase(command: AddMetalPurchaseCommand): Promise<void> {
    const operation = "metalPurchases.addPurchase"
    await requireAuthenticatedUserId(this.client, operation)

    const { data, error } = await this.client.rpc("add_metal_purchase", {
      p_account_id: command.accountId,
      p_purity: command.purity,
      p_occurred_at: command.occurredAt,
      p_quantity_grams: command.quantityGrams,
      p_cost_per_unit: command.costPerUnit,
      p_funding_mode: command.fundingMode,
      p_funding_account_id: command.fundingAccountId,
      p_fees: command.fees,
      p_notes: command.notes,
    })

    requireQueryData(data, error, operation)
  }

  async reversePurchase(purchaseId: string): Promise<void> {
    const operation = "metalPurchases.reversePurchase"
    await requireAuthenticatedUserId(this.client, operation)

    const { data, error } = await this.client.rpc("reverse_metal_purchase", {
      p_purchase_id: purchaseId,
    })

    requireQueryData(data, error, operation)
  }

  async correctPurchase(
    purchaseId: string,
    command: AddMetalPurchaseCommand
  ): Promise<void> {
    const operation = "metalPurchases.correctPurchase"
    await requireAuthenticatedUserId(this.client, operation)

    const { data, error } = await this.client.rpc("correct_metal_purchase", {
      p_purchase_id: purchaseId,
      p_purity: command.purity,
      p_occurred_at: command.occurredAt,
      p_quantity_grams: command.quantityGrams,
      p_cost_per_unit: command.costPerUnit,
      p_funding_mode: command.fundingMode,
      p_funding_account_id: command.fundingAccountId,
      p_fees: command.fees,
      p_notes: command.notes,
    })

    requireQueryData(data, error, operation)
  }

  async getPurchaseHistoryRows(
    accountIds: readonly string[]
  ): Promise<MetalPurchaseHistoryRow[]> {
    if (accountIds.length === 0) return []

    const operation = "metalPurchases.getPurchases"
    await requireAuthenticatedUserId(this.client, operation)
    const { data, error } = await this.client.rpc("get_effective_metal_purchases", {
      p_account_ids: [...accountIds],
    })

    return requireQueryData(data, error, operation)
      .map((row) => mapMetalPurchaseHistoryRow(row as MetalPurchaseRecord))
  }
}

export const metalPurchasesRepository = new MetalPurchasesRepository()
