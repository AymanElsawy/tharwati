import { supabase, type TypedSupabaseClient } from "@/lib/supabase/client"
import {
  requireAuthenticatedUserId,
  requireQueryData,
} from "@/lib/supabase/repository"

export type AccountRecordRow = {
  id: string
  occurred_at: string
  transaction_type_code: string
  description: string
  transaction_currency_code: string
  account_entries: Array<{ transaction_amount: string }>
}

const accountRecordSelect = `
  id,
  occurred_at,
  transaction_type_code,
  description,
  transaction_currency_code,
  account_entries:transaction_entries!inner(account_id,transaction_amount::text)
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
}

export const accountRecordsRepository = new AccountRecordsRepository()
