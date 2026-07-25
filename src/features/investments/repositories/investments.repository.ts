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
    const { data, error } = await this.client.rpc("add_investment", input)

    return requireQueryData(
      data,
      error,
      operation,
    ) as unknown as AddInvestmentResult
  }
}

export const investmentsRepository = new InvestmentsRepository()
