import {
  supabase,
  type TypedSupabaseClient,
} from "../../../lib/supabase/client"
import {
  requireAuthenticatedUserId,
  requireQueryData,
} from "../../../lib/supabase/repository"
import { RepositoryError } from "../../../lib/supabase/types"
import type {
  AccountSummary,
  Decimal,
  TableUpdate,
} from "../../../lib/supabase/types"

export type CreateAccountInput = {
  accountTypeCode: string
  name: string
  currencyCode: string
  institutionName?: string | null
  openingBalance?: Decimal
  notes?: string | null
}

export type UpdateAccountInput = {
  accountTypeCode?: string
  name?: string
  currencyCode?: string
  institutionName?: string | null
  openingBalance?: Decimal
  notes?: string | null
  isActive?: boolean
}

export type AccountDeletionEligibility = {
  accountId: string
  canDelete: boolean
  hasFinancialHistory: boolean
}

const immutableCurrencyMessage =
  "This account already contains financial history. Its currency cannot be changed."
const immutableOpeningBalanceMessage =
  "This account already contains financial history. Its opening balance cannot be changed."

type DatabaseError = {
  code?: string
  message: string
}

function throwAccountUpdateError(
  error: DatabaseError | null,
  operation: string,
): void {
  if (!error) {
    return
  }

  if (
    error.code === "23514" &&
    error.message.includes(immutableCurrencyMessage)
  ) {
    throw new RepositoryError({
      code: "constraint_violation",
      message: immutableCurrencyMessage,
      operation,
      cause: error,
    })
  }

  if (
    error.code === "23514" &&
    error.message.includes(immutableOpeningBalanceMessage)
  ) {
    throw new RepositoryError({
      code: "constraint_violation",
      message: immutableOpeningBalanceMessage,
      operation,
      cause: error,
    })
  }
}

export class AccountsRepository {
  private readonly client: TypedSupabaseClient

  constructor(client: TypedSupabaseClient = supabase) {
    this.client = client
  }

  async getAccounts(): Promise<AccountSummary[]> {
    const operation = "accounts.getAccounts"
    const userId = await requireAuthenticatedUserId(this.client, operation)
    const { data, error } = await this.client
      .from("financial_accounts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    return requireQueryData(data, error, operation)
  }

  async getAccount(id: string): Promise<AccountSummary> {
    const operation = "accounts.getAccount"
    const userId = await requireAuthenticatedUserId(this.client, operation)
    const { data, error } = await this.client
      .from("financial_accounts")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single()

    return requireQueryData(data, error, operation)
  }

  async createAccount(input: CreateAccountInput): Promise<AccountSummary> {
    const operation = "accounts.createAccount"
    const userId = await requireAuthenticatedUserId(this.client, operation)
    const { data, error } = await this.client
      .from("financial_accounts")
      .insert({
        user_id: userId,
        account_type_code: input.accountTypeCode,
        name: input.name,
        currency_code: input.currencyCode,
        institution_name: input.institutionName,
        opening_balance: input.openingBalance,
        notes: input.notes,
      })
      .select("*")
      .single()

    return requireQueryData(data, error, operation)
  }

  async updateAccount(
    id: string,
    input: UpdateAccountInput,
  ): Promise<AccountSummary> {
    const operation = "accounts.updateAccount"
    const userId = await requireAuthenticatedUserId(this.client, operation)
    const update: TableUpdate<"financial_accounts"> = {}

    if (input.accountTypeCode !== undefined) {
      update.account_type_code = input.accountTypeCode
    }
    if (input.name !== undefined) {
      update.name = input.name
    }
    if (input.currencyCode !== undefined) {
      update.currency_code = input.currencyCode
    }
    if (input.institutionName !== undefined) {
      update.institution_name = input.institutionName
    }
    if (input.openingBalance !== undefined) {
      update.opening_balance = input.openingBalance
    }
    if (input.notes !== undefined) {
      update.notes = input.notes
    }
    if (input.isActive !== undefined) {
      update.is_active = input.isActive
    }

    const { data, error } = await this.client
      .from("financial_accounts")
      .update(update)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single()

    throwAccountUpdateError(error, operation)
    return requireQueryData(data, error, operation)
  }

  async archiveAccount(id: string): Promise<AccountSummary> {
    return this.updateAccount(id, { isActive: false })
  }

  async getAccountDeletionEligibility(
    accountIds: string[],
  ): Promise<AccountDeletionEligibility[]> {
    const operation = "accounts.getAccountDeletionEligibility"

    if (accountIds.length === 0) {
      return []
    }

    const userId = await requireAuthenticatedUserId(this.client, operation)
    const [holdingsResult, entriesResult] = await Promise.all([
      this.client
        .from("holdings")
        .select("account_id")
        .eq("user_id", userId)
        .in("account_id", accountIds),
      this.client
        .from("transaction_entries")
        .select("account_id")
        .eq("user_id", userId)
        .in("account_id", accountIds),
    ])
    const holdings = requireQueryData(
      holdingsResult.data,
      holdingsResult.error,
      operation,
    )
    const entries = requireQueryData(
      entriesResult.data,
      entriesResult.error,
      operation,
    )
    const referencedAccountIds = new Set([
      ...holdings.map((holding) => holding.account_id),
      ...entries.map((entry) => entry.account_id),
    ])
    const accountIdsWithHistory = new Set(
      entries.map((entry) => entry.account_id),
    )

    return accountIds.map((accountId) => ({
      accountId,
      canDelete: !referencedAccountIds.has(accountId),
      hasFinancialHistory: accountIdsWithHistory.has(accountId),
    }))
  }

  async deleteAccount(id: string): Promise<void> {
    const operation = "accounts.deleteAccount"
    const userId = await requireAuthenticatedUserId(this.client, operation)
    const [eligibility] = await this.getAccountDeletionEligibility([id])

    if (!eligibility?.canDelete) {
      throw new RepositoryError({
        code: "constraint_violation",
        message:
          "Accounts with holdings or transaction history cannot be deleted",
        operation,
      })
    }

    const { data, error } = await this.client
      .from("financial_accounts")
      .delete()
      .eq("id", id)
      .eq("user_id", userId)
      .select("id")
      .single()

    requireQueryData(data, error, operation)
  }
}

export const accountsRepository = new AccountsRepository()
