import { supabase, type TypedSupabaseClient } from "@/lib/supabase/client"
import { READ_DEADLINE_MS, readWithDeadline } from "@/lib/network/read-deadline"
import {
  requireAuthenticatedUserId,
  requireQueryData,
} from "@/lib/supabase/repository"
import type { TableRow } from "@/lib/supabase/types"
import type { Decimal } from "@/lib/supabase/types"
import { normalizeDecimal } from "@/lib/financial-calculations/decimal"
import { RepositoryError } from "@/lib/supabase/types"

export function requireDecimalText(value: unknown, field: string): Decimal {
  if (typeof value !== "string" || normalizeDecimal(value) === null) {
    throw new RepositoryError({
      code: "database_error",
      message: `Dashboard activity field ${field} must be a PostgreSQL decimal string`,
      operation: "dashboard.mapPostedTransaction",
    })
  }
  return value
}

export type DashboardPostedTransaction = TableRow<"financial_transactions"> & {
  transaction_entries: Array<
    Pick<
      TableRow<"transaction_entries">,
      | "id"
      | "account_id"
      | "asset_id"
      | "entry_side"
      | "transaction_amount"
      | "account_amount"
      | "quantity_delta"
      | "memo"
    >
  >
}

export interface DashboardRepositoryContract {
  getRecentPostedTransactions(
    limit?: number
  ): Promise<DashboardPostedTransaction[]>
}

export class DashboardRepository implements DashboardRepositoryContract {
  private readonly client: TypedSupabaseClient

  constructor(client: TypedSupabaseClient = supabase) {
    this.client = client
  }

  async getRecentPostedTransactions(limit = 8) {
    const operation = "dashboard.getRecentPostedTransactions"
    const userId = await readWithDeadline(READ_DEADLINE_MS.simple, () => requireAuthenticatedUserId(this.client, operation))
    const { data, error } = await readWithDeadline(READ_DEADLINE_MS.financial, (signal) => this.client
      .from("financial_transactions")
      .select(
        "*, transaction_entries(id, account_id, asset_id, entry_side, transaction_amount::text, account_amount::text, quantity_delta::text, memo)"
      )
      .eq("user_id", userId)
      .eq("status", "posted")
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit)
      .abortSignal(signal))
    const rows = requireQueryData(data, error, operation)
    return rows.map((transaction) => ({
      ...transaction,
      transaction_entries: transaction.transaction_entries.map((entry) => ({
        ...entry,
        transaction_amount: requireDecimalText(
          entry.transaction_amount,
          "transaction_amount"
        ),
        account_amount: requireDecimalText(
          entry.account_amount,
          "account_amount"
        ),
        quantity_delta:
          entry.quantity_delta === null
            ? null
            : requireDecimalText(entry.quantity_delta, "quantity_delta"),
      })),
    }))
  }
}

export const dashboardRepository = new DashboardRepository()
