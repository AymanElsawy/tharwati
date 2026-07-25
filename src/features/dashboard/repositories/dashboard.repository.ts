import {
  supabase,
  type TypedSupabaseClient,
} from "@/lib/supabase/client"
import {
  requireAuthenticatedUserId,
  requireQueryData,
} from "@/lib/supabase/repository"
import type { TableRow } from "@/lib/supabase/types"

export type DashboardPostedTransaction =
  TableRow<"financial_transactions"> & {
    transaction_entries: Array<
      Pick<
        TableRow<"transaction_entries">,
        "id" | "memo" | "transaction_amount"
      >
    >
  }

export interface DashboardRepositoryContract {
  getRecentPostedTransactions(
    limit?: number,
  ): Promise<DashboardPostedTransaction[]>
}

export class DashboardRepository
  implements DashboardRepositoryContract
{
  private readonly client: TypedSupabaseClient

  constructor(client: TypedSupabaseClient = supabase) {
    this.client = client
  }

  async getRecentPostedTransactions(limit = 8) {
    const operation = "dashboard.getRecentPostedTransactions"
    const userId = await requireAuthenticatedUserId(
      this.client,
      operation,
    )
    const { data, error } = await this.client
      .from("financial_transactions")
      .select("*, transaction_entries(id, memo, transaction_amount)")
      .eq("user_id", userId)
      .eq("status", "posted")
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit)
    return requireQueryData(data, error, operation)
  }
}

export const dashboardRepository = new DashboardRepository()
