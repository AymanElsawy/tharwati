import { supabase, type TypedSupabaseClient } from "@/lib/supabase/client"
import {
  requireAuthenticatedUserId,
  requireQueryData,
} from "@/lib/supabase/repository"
import type { Decimal } from "@/lib/supabase/types"
import type {
  AccountBalance,
  AccountBalanceRepository as AccountBalanceRepositoryContract,
} from "@/features/account-balances/types/account-balance"

const decimalPattern = /^-?\d+(?:\.\d+)?$/

function requireDecimal(value: unknown, field: string): Decimal {
  if (typeof value !== "string" || !decimalPattern.test(value)) {
    throw new TypeError(`${field} is not a PostgreSQL decimal`)
  }
  return value
}

export class AccountBalancesRepository
  implements AccountBalanceRepositoryContract
{
  private readonly client: TypedSupabaseClient

  constructor(client: TypedSupabaseClient = supabase) {
    this.client = client
  }

  async getAccountBalances(
    accountIds?: readonly string[],
  ): Promise<AccountBalance[]> {
    const operation = "accountBalances.getAll"
    await requireAuthenticatedUserId(this.client, operation)
    const { data, error } = await this.client.rpc("get_account_balances", {
      p_account_ids: accountIds ? [...accountIds] : null,
    })
    const rows = requireQueryData(data, error, operation)

    return rows.map((row) => ({
      accountId: row.account_id,
      accountTypeCode: row.account_type_code,
      accountName: row.account_name,
      currencyCode: row.currency_code,
      isActive: row.is_active,
      openingBalance: requireDecimal(row.opening_balance, "opening_balance"),
      ledgerEffect: requireDecimal(row.ledger_effect, "ledger_effect"),
      currentBalance: requireDecimal(row.current_balance, "current_balance"),
    }))
  }
}

export const accountBalancesRepository = new AccountBalancesRepository()
