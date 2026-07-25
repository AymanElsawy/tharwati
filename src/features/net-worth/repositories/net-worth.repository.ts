import {
  supabase,
  type TypedSupabaseClient,
} from "@/lib/supabase/client"
import {
  requireAuthenticatedUserId,
  requireQueryData,
} from "@/lib/supabase/repository"
import type { NetWorthSourceData } from "@/features/net-worth/types/net-worth"
import { RepositoryError, type Decimal } from "@/lib/supabase/types"

const postgresDecimalPattern = /^-?\d+(?:\.\d+)?$/

function decodePostgresDecimal(
  value: unknown,
  field: string,
  operation: string,
): Decimal {
  if (typeof value === "string" && postgresDecimalPattern.test(value)) {
    return value
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    // financial_accounts.opening_balance is numeric(20, 2). Only accept a
    // PostgREST number when its scaled integer is safe; otherwise conversion
    // could silently preserve an already-rounded JavaScript value.
    const scaledValue = value * 100
    if (
      Number.isSafeInteger(Math.round(scaledValue)) &&
      Math.abs(scaledValue - Math.round(scaledValue)) < Number.EPSILON * 100
    ) {
      return value.toString()
    }
  }

  throw new RepositoryError({
    code: "database_error",
    message: `${field} was not returned as a safe PostgreSQL numeric value`,
    operation,
  })
}

export class NetWorthRepository {
  private readonly client: TypedSupabaseClient

  constructor(client: TypedSupabaseClient = supabase) {
    this.client = client
  }

  async getSourceData(): Promise<NetWorthSourceData> {
    const operation = "netWorth.getSourceData"
    const userId = await requireAuthenticatedUserId(this.client, operation)
    const [accountsResult, profileResult] = await Promise.all([
      this.client
        .from("financial_accounts")
        .select("id, opening_balance, currency_code")
        .eq("user_id", userId)
        .eq("account_type_code", "cash")
        .eq("is_active", true),
      this.client
        .from("profiles")
        .select("default_currency_code")
        .eq("id", userId)
        .single(),
    ])
    const accounts = requireQueryData(
      accountsResult.data,
      accountsResult.error,
      operation,
    )
    const profile = requireQueryData(
      profileResult.data,
      profileResult.error,
      operation,
    )

    return {
      baseCurrency: profile.default_currency_code,
      accounts: accounts.map((account) => ({
        accountId: account.id,
        balance: decodePostgresDecimal(
          account.opening_balance,
          "financial_accounts.opening_balance",
          operation,
        ),
        currencyCode: account.currency_code,
      })),
    }
  }
}

export const netWorthRepository = new NetWorthRepository()
