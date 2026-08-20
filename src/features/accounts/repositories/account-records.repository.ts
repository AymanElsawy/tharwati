import { supabase, type TypedSupabaseClient } from "@/lib/supabase/client"
import {
  requireAuthenticatedUserId,
  requireQueryData,
} from "@/lib/supabase/repository"
import { toRepositoryError } from "@/lib/supabase/types"
import { localDateTimeInputToIso } from "@/lib/formatting/local-date-time"
import type { AccountRecordFormValues } from "../types/account-record"

export type AccountRecordRow = {
  id: string
  occurred_at: string
  transaction_type_code: string
  description: string
  transaction_currency_code: string
  account_entries: Array<{
    entry_side: "debit" | "credit"
    account_amount: string
    account: { currency_code: string } | null
  }>
}

export type AccountBalanceRow = { account_id: string; current_balance: string }

const accountRecordSelect = `
  id,
  occurred_at,
  transaction_type_code,
  description,
  transaction_currency_code,
  account_entries:transaction_entries!inner(
    account_id,
    entry_side,
    account_amount::text,
    account:financial_accounts!transaction_entries_account_id_fkey(currency_code)
  )
` as const

export class AccountRecordsRepository {
  private readonly client: TypedSupabaseClient

  constructor(client: TypedSupabaseClient = supabase) {
    this.client = client
  }

  async getAccountRecordRows(accountId: string): Promise<AccountRecordRow[]> {
    const operation = "accountRecords.getAccountRecords"
    const userId = await requireAuthenticatedUserId(this.client, operation)
    const { data, error } = await this.client
      .from("financial_transactions")
      .select(accountRecordSelect)
      .eq("user_id", userId)
      .eq("account_entries.account_id", accountId)
      .order("occurred_at", { ascending: false })
      .order("created_at", { ascending: false })

    return requireQueryData(
      data,
      error,
      operation
    ) as unknown as AccountRecordRow[]
  }

  async addAccountRecord(values: AccountRecordFormValues): Promise<void> {
    const operation = "accountRecords.addAccountRecord"
    const { error } = await this.client.rpc("add_account_record", {
      p_record_type: values.type,
      p_account_id: values.accountId,
      p_counterparty_account_id: values.type === "transfer" ? values.toAccountId : null,
      p_amount: values.amount,
      p_received_amount: values.type === "transfer" ? values.receivedAmount || null : null,
      p_occurred_at: localDateTimeInputToIso(values.occurredAt),
      p_category: null,
      p_notes: values.notes.trim() || null,
      p_main_category_id: values.type === "transfer" ? null : values.mainCategoryId,
      p_subcategory_id: values.type === "transfer" ? null : values.subcategoryId,
    })
    if (error) throw toRepositoryError(error, operation)
  }

  async getAccountBalances(accountIds: string[]): Promise<AccountBalanceRow[]> {
    if (accountIds.length === 0) return []
    const operation = "accountRecords.getAccountBalances"
    const { data, error } = await this.client.rpc("get_account_balances", { p_account_ids: accountIds })
    return requireQueryData(data, error, operation) as AccountBalanceRow[]
  }
}

export const accountRecordsRepository = new AccountRecordsRepository()
