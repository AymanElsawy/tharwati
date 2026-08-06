import {
  supabase,
  type TypedSupabaseClient,
} from "../../../lib/supabase/client"
import {
  requireAuthenticatedUserId,
  requireQueryData,
} from "../../../lib/supabase/repository"
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
  holding: HoldingRuntimeRow,
): HoldingDetails {
  return {
    ...holding,
    quantity: String(holding.quantity),
    average_cost:
      holding.average_cost === null
        ? null
        : String(holding.average_cost),
    total_cost_basis: String(holding.total_cost_basis),
  }
}

export class HoldingsRepository {
  private readonly client: TypedSupabaseClient

  constructor(client: TypedSupabaseClient = supabase) {
    this.client = client
  }

  async getHoldings(): Promise<HoldingDetails[]> {
    const operation = "holdings.getHoldings"
    const userId = await requireAuthenticatedUserId(this.client, operation)
    const { data, error } = await this.client
      .from("holdings")
      .select(
        `
          *,
          asset:assets!holdings_asset_id_assets_fkey(
            id,
            name,
            symbol,
            asset_type_code,
            currency_code,
            canonical_quantity_unit
          ),
          account:financial_accounts!holdings_account_id_financial_accounts_fkey(
            id,
            name,
            currency_code
          )
        `,
      )
      .eq("user_id", userId)
      .gt("quantity", "0")
      .order("updated_at", { ascending: false })

    const holdings = requireQueryData(data, error, operation)
    return holdings.map((holding) =>
      normalizeHoldingRow(holding as HoldingRuntimeRow),
    )
  }
}

export const holdingsRepository = new HoldingsRepository()
