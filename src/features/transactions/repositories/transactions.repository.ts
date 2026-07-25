import {
  supabase,
  type TypedSupabaseClient,
} from "../../../lib/supabase/client"
import {
  requireAuthenticatedUserId,
  requireQueryData,
} from "../../../lib/supabase/repository"
import type {
  TableRow,
  TableUpdate,
  TransactionDetails,
  TransactionDraft,
  TransactionEntryInput,
} from "../../../lib/supabase/types"

export type UpdateTransactionEntryInput = Partial<TransactionEntryInput> & {
  transactionId?: string
}

export class TransactionsRepository {
  private readonly client: TypedSupabaseClient

  constructor(client: TypedSupabaseClient = supabase) {
    this.client = client
  }

  async createDraftTransaction(
    draft: TransactionDraft,
  ): Promise<TransactionDetails> {
    const operation = "transactions.createDraftTransaction"
    const userId = await requireAuthenticatedUserId(this.client, operation)
    const { data, error } = await this.client
      .from("financial_transactions")
      .insert({
        user_id: userId,
        transaction_type_code: draft.transactionTypeCode,
        transaction_currency_code: draft.transactionCurrencyCode,
        status: "draft",
        description: draft.description,
        occurred_at: draft.occurredAt,
        external_reference: draft.externalReference,
        notes: draft.notes,
        posted_at: null,
      })
      .select("*")
      .single()

    return {
      transaction: requireQueryData(data, error, operation),
      entries: [],
    }
  }

  async addEntry(
    transactionId: string,
    input: TransactionEntryInput,
  ): Promise<TableRow<"transaction_entries">> {
    const operation = "transactions.addEntry"
    const userId = await requireAuthenticatedUserId(this.client, operation)
    const { data, error } = await this.client
      .from("transaction_entries")
      .insert({
        transaction_id: transactionId,
        user_id: userId,
        account_id: input.accountId,
        asset_id: input.assetId,
        entry_side: input.entrySide,
        transaction_amount: input.transactionAmount,
        account_amount: input.accountAmount,
        quantity_delta: input.quantityDelta,
        unit_price: input.unitPrice,
        memo: input.memo,
      })
      .select("*")
      .single()

    return requireQueryData(data, error, operation)
  }

  async updateEntry(
    entryId: string,
    input: UpdateTransactionEntryInput,
  ): Promise<TableRow<"transaction_entries">> {
    const operation = "transactions.updateEntry"
    const userId = await requireAuthenticatedUserId(this.client, operation)
    const update: TableUpdate<"transaction_entries"> = {}

    if (input.transactionId !== undefined) {
      update.transaction_id = input.transactionId
    }
    if (input.accountId !== undefined) {
      update.account_id = input.accountId
    }
    if (input.assetId !== undefined) {
      update.asset_id = input.assetId
    }
    if (input.entrySide !== undefined) {
      update.entry_side = input.entrySide
    }
    if (input.transactionAmount !== undefined) {
      update.transaction_amount = input.transactionAmount
    }
    if (input.accountAmount !== undefined) {
      update.account_amount = input.accountAmount
    }
    if (input.quantityDelta !== undefined) {
      update.quantity_delta = input.quantityDelta
    }
    if (input.unitPrice !== undefined) {
      update.unit_price = input.unitPrice
    }
    if (input.memo !== undefined) {
      update.memo = input.memo
    }

    const { data, error } = await this.client
      .from("transaction_entries")
      .update(update)
      .eq("id", entryId)
      .eq("user_id", userId)
      .select("*")
      .single()

    return requireQueryData(data, error, operation)
  }

  async removeEntry(entryId: string): Promise<void> {
    const operation = "transactions.removeEntry"
    const userId = await requireAuthenticatedUserId(this.client, operation)
    const { data, error } = await this.client
      .from("transaction_entries")
      .delete()
      .eq("id", entryId)
      .eq("user_id", userId)
      .select("id")
      .single()

    requireQueryData(data, error, operation)
  }

  async postTransaction(
    transactionId: string,
  ): Promise<TableRow<"financial_transactions">> {
    const operation = "transactions.postTransaction"
    await requireAuthenticatedUserId(this.client, operation)

    // Posting is intentionally one database operation; balancing stays in SQL.
    const { data, error } = await this.client.rpc("post_transaction", {
      transaction_id: transactionId,
    })

    return requireQueryData(data, error, operation)
  }

  async deleteDraftTransaction(transactionId: string): Promise<void> {
    const operation = "transactions.deleteDraftTransaction"
    const userId = await requireAuthenticatedUserId(this.client, operation)
    const { data, error } = await this.client
      .from("financial_transactions")
      .delete()
      .eq("id", transactionId)
      .eq("user_id", userId)
      .eq("status", "draft")
      .select("id")
      .single()

    requireQueryData(data, error, operation)
  }

  async getTransaction(transactionId: string): Promise<TransactionDetails> {
    const operation = "transactions.getTransaction"
    const userId = await requireAuthenticatedUserId(this.client, operation)
    const { data, error } = await this.client
      .from("financial_transactions")
      .select("*, transaction_entries(*)")
      .eq("id", transactionId)
      .eq("user_id", userId)
      .single()

    const result = requireQueryData(data, error, operation)
    const { transaction_entries: entries, ...transaction } = result

    return {
      transaction,
      entries: [...entries].sort((left, right) =>
        left.created_at.localeCompare(right.created_at),
      ),
    }
  }

  async getTransactions(): Promise<
    TableRow<"financial_transactions">[]
  > {
    const operation = "transactions.getTransactions"
    const userId = await requireAuthenticatedUserId(this.client, operation)
    const { data, error } = await this.client
      .from("financial_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("occurred_at", { ascending: false })

    return requireQueryData(data, error, operation)
  }
}

export const transactionsRepository = new TransactionsRepository()
