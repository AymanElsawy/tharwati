import {
  supabase,
  type TypedSupabaseClient,
} from "../../../lib/supabase/client"
import {
  requireAuthenticatedUserId,
  requireQueryData,
} from "../../../lib/supabase/repository"
import type { Decimal } from "@/lib/supabase/types"
import type { HoldingDetails } from "../types/holding"

type HoldingRuntimeRow = Omit<
  HoldingDetails,
  "quantity" | "average_cost" | "total_cost_basis"
> & {
  quantity: string | number
  average_cost: string | number | null
  total_cost_basis: string | number
}

export function normalizeHoldingRow(
  holding: HoldingRuntimeRow
): HoldingDetails {
  return {
    ...holding,
    quantity: String(holding.quantity),
    average_cost:
      holding.average_cost === null ? null : String(holding.average_cost),
    total_cost_basis: String(holding.total_cost_basis),
  }
}

export type ExistingHoldingHistoryItem = {
  id: string
  occurred_at: string
  transaction_type_code: "opening_position" | "opening_position_reversal" | "buy"
  transaction_currency_code: string
  notes: string | null
  reverses_transaction_id: string | null
  corrects_transaction_id: string | null
  entries: Array<{
    account_id: string | null
    asset_id: string | null
    quantity_delta: Decimal | null
    cost_basis_delta: Decimal | null
    account_cost_basis_delta: Decimal | null
    account_fx_rate: Decimal | null
    unit_price: Decimal | null
    memo: string | null
  }>
}

type ExistingHoldingHistoryRuntimeItem = Omit<
  ExistingHoldingHistoryItem,
  "entries"
> & {
  entries: Array<
    Omit<ExistingHoldingHistoryItem["entries"][number],
      | "quantity_delta"
      | "cost_basis_delta"
      | "account_cost_basis_delta"
      | "account_fx_rate"
      | "unit_price"
    > & {
      quantity_delta: string | number | null
      cost_basis_delta: string | number | null
      account_cost_basis_delta: string | number | null
      account_fx_rate: string | number | null
      unit_price: string | number | null
    }
  >
}

function normalizeHistoryDecimal(value: string | number | null): Decimal | null {
  return value === null ? null : String(value)
}

export function normalizeExistingHoldingHistoryItem(
  item: ExistingHoldingHistoryRuntimeItem
): ExistingHoldingHistoryItem {
  return {
    ...item,
    entries: item.entries.map((entry) => ({
      ...entry,
      quantity_delta: normalizeHistoryDecimal(entry.quantity_delta),
      cost_basis_delta: normalizeHistoryDecimal(entry.cost_basis_delta),
      account_cost_basis_delta: normalizeHistoryDecimal(
        entry.account_cost_basis_delta
      ),
      account_fx_rate: normalizeHistoryDecimal(entry.account_fx_rate),
      unit_price: normalizeHistoryDecimal(entry.unit_price),
    })),
  }
}

export type CorrectExistingHoldingInput = {
  originalTransactionId: string
  quantity: string
  averageCost: string
  occurredAt: string
  notes: string | null
  accountFxRate: string | null
}

export class HoldingsRepository {
  private readonly client: TypedSupabaseClient

  constructor(client: TypedSupabaseClient = supabase) {
    this.client = client
  }

  async getHoldings(): Promise<HoldingDetails[]> {
    return this.getFilteredHoldings()
  }

  async getHoldingsForAccount(accountId: string): Promise<HoldingDetails[]> {
    return this.getFilteredHoldings(accountId)
  }

  async getHoldingForAccountAsset(
    accountId: string,
    assetId: string
  ): Promise<HoldingDetails | null> {
    const operation = "holdings.getHoldingForAccountAsset"
    const userId = await requireAuthenticatedUserId(this.client, operation)
    const { data, error } = await this.client
      .from("holdings")
      .select(
        `
          *,
          asset:assets!holdings_asset_id_fkey(
            id, name, symbol, exchange, asset_type_code, currency_code,
            canonical_quantity_unit
          ),
          account:financial_accounts!holdings_account_id_fkey(
            id, name, currency_code
          )
        `
      )
      .eq("user_id", userId)
      .eq("account_id", accountId)
      .eq("asset_id", assetId)
      .maybeSingle()

    const holding = requireQueryData(data, error, operation)
    return holding
      ? normalizeHoldingRow(holding as unknown as HoldingRuntimeRow)
      : null
  }

  async getExistingHoldingHistory(
    accountId: string,
    assetId: string
  ): Promise<ExistingHoldingHistoryItem[]> {
    const operation = "holdings.getExistingHoldingHistory"
    const userId = await requireAuthenticatedUserId(this.client, operation)
    const { data, error } = await this.client
      .from("financial_transactions")
      .select(
        `
          id, occurred_at, transaction_type_code, transaction_currency_code,
          notes, reverses_transaction_id, corrects_transaction_id,
          transaction_entries!inner(
            account_id, asset_id, quantity_delta, cost_basis_delta,
            account_cost_basis_delta, account_fx_rate, unit_price, memo
          )
        `
      )
      .eq("user_id", userId)
      .eq("status", "posted")
      .in("transaction_type_code", [
        "opening_position",
        "opening_position_reversal",
        "buy",
      ])
      .eq("transaction_entries.account_id", accountId)
      .eq("transaction_entries.asset_id", assetId)
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })

    const rows = requireQueryData(data, error, operation) as Array<{
      id: string
      occurred_at: string
      transaction_type_code: "opening_position" | "opening_position_reversal"
      transaction_currency_code: string
      notes: string | null
      reverses_transaction_id: string | null
      corrects_transaction_id: string | null
      transaction_entries: ExistingHoldingHistoryRuntimeItem["entries"]
    }>

    return rows.map(({ transaction_entries, ...transaction }) =>
      normalizeExistingHoldingHistoryItem({
        ...transaction,
        entries: transaction_entries,
      })
    )
  }

  async reverseExistingHolding(transactionId: string): Promise<void> {
    const operation = "holdings.reverseExistingHolding"
    await requireAuthenticatedUserId(this.client, operation)
    const { error } = await this.client.rpc("reverse_existing_holding", {
      p_transaction_id: transactionId,
    })
    if (error) throw error
  }

  async correctExistingHolding(
    input: CorrectExistingHoldingInput
  ): Promise<void> {
    const operation = "holdings.correctExistingHolding"
    await requireAuthenticatedUserId(this.client, operation)
    const { error } = await this.client.rpc("correct_existing_holding", {
      p_original_transaction_id: input.originalTransactionId,
      p_quantity: input.quantity,
      p_average_cost: input.averageCost,
      p_occurred_at: input.occurredAt,
      p_notes: input.notes,
      p_account_fx_rate: input.accountFxRate,
    })
    if (error) throw error
  }

  private async getFilteredHoldings(
    accountId?: string
  ): Promise<HoldingDetails[]> {
    const operation = "holdings.getHoldings"
    const userId = await requireAuthenticatedUserId(this.client, operation)
    const query = this.client
      .from("holdings")
      .select(
        `
          *,
          asset:assets!holdings_asset_id_fkey(
            id,
            name,
            symbol,
            exchange,
            asset_type_code,
            currency_code,
            canonical_quantity_unit
          ),
          account:financial_accounts!holdings_account_id_fkey(
            id,
            name,
            currency_code
          )
        `
      )
      .eq("user_id", userId)
      .gt("quantity", "0")
      .order("updated_at", { ascending: false })

    const { data, error } = await (accountId
      ? query.eq("account_id", accountId)
      : query)

    const holdings = requireQueryData(data, error, operation)
    return holdings.map((holding) =>
      normalizeHoldingRow(holding as unknown as HoldingRuntimeRow)
    )
  }
}

export const holdingsRepository = new HoldingsRepository()
