import { accountBalancesService } from "@/features/account-balances/services/account-balances.service"
import type { AccountBalance } from "@/features/account-balances/types/account-balance"
import type { NetWorthSourceData } from "@/features/net-worth/types/net-worth"
import {
  supabase,
  type TypedSupabaseClient,
} from "@/lib/supabase/client"
import {
  requireAuthenticatedUserId,
  requireQueryData,
} from "@/lib/supabase/repository"

interface WealthCashBalanceReader {
  getEligibleWealthCashBalances(): Promise<AccountBalance[]>
}

export class NetWorthRepository {
  private readonly client: TypedSupabaseClient
  private readonly balances: WealthCashBalanceReader

  constructor(
    client: TypedSupabaseClient = supabase,
    balances: WealthCashBalanceReader = accountBalancesService,
  ) {
    this.client = client
    this.balances = balances
  }

  async getSourceData(): Promise<NetWorthSourceData> {
    const operation = "netWorth.getSourceData"
    const userId = await requireAuthenticatedUserId(this.client, operation)
    const [accounts, profileResult] = await Promise.all([
      this.balances.getEligibleWealthCashBalances(),
      this.client
        .from("profiles")
        .select("default_currency_code")
        .eq("id", userId)
        .single(),
    ])
    const profile = requireQueryData(
      profileResult.data,
      profileResult.error,
      operation,
    )

    return {
      baseCurrency: profile.default_currency_code,
      accounts: accounts.map((account) => ({
        accountId: account.accountId,
        balance: account.currentBalance,
        currencyCode: account.currencyCode,
      })),
    }
  }
}

export const netWorthRepository = new NetWorthRepository()
