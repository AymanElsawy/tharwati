import {
  supabase,
  type TypedSupabaseClient,
} from "../../../lib/supabase/client"
import {
  requireAuthenticatedUserId,
  requireQueryData,
} from "../../../lib/supabase/repository"
import type { Database } from "../../../lib/supabase/types"
import type { AddInvestmentResult } from "../types/add-investment"
import type { EditInvestmentResult } from "../types/edit-investment"

export class InvestmentsRepository {
  private readonly client: TypedSupabaseClient

  constructor(client: TypedSupabaseClient = supabase) {
    this.client = client
  }

  async addInvestment(
    input: Database["public"]["Functions"]["add_investment"]["Args"],
  ): Promise<AddInvestmentResult> {
    const operation = "investments.addInvestment"
    await requireAuthenticatedUserId(this.client, operation)
    const { data, error } = await this.client.functions.invoke<{ result: AddInvestmentResult }>("investment-fx", { body: { operation: "add", args: input } })

    return requireQueryData(
      data?.result ?? null,
      error,
      operation,
    ) as unknown as AddInvestmentResult
  }

  async getInvestment(transactionId: string) {
    const operation = "investments.getInvestment"
    const userId = await requireAuthenticatedUserId(this.client, operation)
    const { data, error } = await this.client
      .from("financial_transactions")
      .select("*, transaction_entries(id, account_id, asset_id, transaction_amount::text, quantity_delta::text, unit_price::text, memo)")
      .eq("id", transactionId)
      .eq("user_id", userId)
      .eq("transaction_type_code", "buy")
      .eq("status", "posted")
      .single()
    return requireQueryData(data, error, operation)
  }

  async editInvestment(
    input: Database["public"]["Functions"]["edit_investment"]["Args"],
  ): Promise<EditInvestmentResult> {
    const operation = "investments.editInvestment"
    await requireAuthenticatedUserId(this.client, operation)
    const { data, error } = await this.client.functions.invoke<{ result: EditInvestmentResult }>("investment-fx", { body: { operation: "edit", args: input } })
    return requireQueryData(data?.result ?? null, error, operation) as unknown as EditInvestmentResult
  }
}

export const investmentsRepository = new InvestmentsRepository()
