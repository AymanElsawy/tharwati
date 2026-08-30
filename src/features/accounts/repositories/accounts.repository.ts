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
import { normalizeDecimal } from "@/lib/financial-calculations/decimal"

export type CreateAccountInput = {
  accountTypeCode: string
  name: string
  currencyCode: string
  openingBalance?: Decimal
  notes?: string | null
  bankSubtype?: "debit" | "credit" | null
  creditCardLimit?: Decimal | null
  dueDayOfMonth?: number | null
  investmentType?: "stock_etf" | "crypto" | "other" | null
  balanceGrams?: Decimal | null
  propertyType?: "apartment" | "villa" | "land" | "office" | "other" | null
  ownershipPercentage?: Decimal | null
  businessType?: string | null
  industry?: string | null
  location?: string | null
  valuationAmount?: Decimal
  valuedOn?: string
  valuationMethod?: string | null
  valuationNotes?: string | null
  metalType?: "gold" | "silver" | null
  purity?: string | null
  purchaseDate?: string | null
  costPerUnit?: Decimal | null
}

export type UpdateAccountInput = {
  accountTypeCode?: string
  name?: string
  currencyCode?: string
  openingBalance?: Decimal
  notes?: string | null
  isActive?: boolean
  bankSubtype?: "debit" | "credit" | null
  creditCardLimit?: Decimal | null
  dueDayOfMonth?: number | null
  investmentType?: "stock_etf" | "crypto" | "other" | null
  balanceGrams?: Decimal | null
  propertyType?: "apartment" | "villa" | "land" | "office" | "other" | null
  ownershipPercentage?: Decimal | null
  businessType?: string | null
  industry?: string | null
  location?: string | null
  metalType?: "gold" | "silver" | null
  purity?: string | null
  purchaseDate?: string | null
  costPerUnit?: Decimal | null
}

export type AccountLifecycleEligibility = {
  accountId: string
  canClose: boolean
  closeBlockReason: string | null
  canDelete: boolean
  deleteBlockReason: string | null
  hasFinancialHistory: boolean
}

const immutableCurrencyMessage =
  "This account already contains financial history. Its currency cannot be changed."
const immutableOpeningBalanceMessage =
  "This account already contains financial history. Its opening balance cannot be changed."
const duplicateMetalAccountMessage =
  "You already have this type of Gold/Silver account in this currency. Go to that account and add a purchase instead of creating a new one."
const duplicateAccountNameMessage =
  "You already have an account with this name. Choose a different name."

type DatabaseError = {
  code?: string
  message: string
}

const accountSelect =
  "id,user_id,account_type_code,name,currency_code,opening_balance::text,notes,is_active,bank_subtype,credit_card_limit::text,due_day_of_month,investment_type,balance_grams::text,property_type,ownership_percentage::text,initial_ownership_percentage::text,closed_on,closed_reason,business_type,industry,location,metal_type,purity,purchase_date,cost_per_unit::text,created_at,updated_at" as const

export function requireAccountDecimalText(
  value: unknown,
  field: string,
  operation: string
): Decimal {
  if (typeof value !== "string" || normalizeDecimal(value) === null) {
    throw new RepositoryError({
      code: "database_error",
      message: `Account field ${field} must be a PostgreSQL decimal string`,
      operation,
    })
  }
  return value
}

function requireNullableAccountDecimalText(
  value: unknown,
  field: string,
  operation: string
): Decimal | null {
  return value === null
    ? null
    : requireAccountDecimalText(value, field, operation)
}

function mapAccountSummary(
  row: AccountSummary,
  operation: string
): AccountSummary {
  return {
    ...row,
    opening_balance: requireAccountDecimalText(
      row.opening_balance,
      "opening_balance",
      operation
    ),
    credit_card_limit: requireNullableAccountDecimalText(
      row.credit_card_limit,
      "credit_card_limit",
      operation
    ),
    balance_grams: requireNullableAccountDecimalText(
      row.balance_grams,
      "balance_grams",
      operation
    ),
    ownership_percentage: requireNullableAccountDecimalText(
      row.ownership_percentage,
      "ownership_percentage",
      operation
    ),
    initial_ownership_percentage: requireNullableAccountDecimalText(
      row.initial_ownership_percentage ?? null,
      "initial_ownership_percentage",
      operation
    ),
    cost_per_unit: requireNullableAccountDecimalText(
      row.cost_per_unit,
      "cost_per_unit",
      operation
    ),
  }
}

function throwAccountConstraintError(
  error: DatabaseError | null,
  operation: string
): void {
  if (!error) {
    return
  }

  if (
    error.code === "23505" &&
    error.message.includes("financial_accounts_user_currency_metal_type_key")
  ) {
    throw new RepositoryError({
      code: "conflict",
      message: duplicateMetalAccountMessage,
      operation,
      cause: error,
    })
  }

  if (
    error.code === "23505" &&
    error.message.includes("financial_accounts_non_metal_user_name_lower_key")
  ) {
    throw new RepositoryError({
      code: "conflict",
      message: duplicateAccountNameMessage,
      operation,
      cause: error,
    })
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
      .select(accountSelect)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    return requireQueryData(data, error, operation).map((row) =>
      mapAccountSummary(row, operation)
    )
  }

  async getAccount(id: string): Promise<AccountSummary> {
    const operation = "accounts.getAccount"
    const userId = await requireAuthenticatedUserId(this.client, operation)
    const { data, error } = await this.client
      .from("financial_accounts")
      .select(accountSelect)
      .eq("id", id)
      .eq("user_id", userId)
      .single()

    return mapAccountSummary(
      requireQueryData(data, error, operation),
      operation
    )
  }

  async createAccount(input: CreateAccountInput): Promise<AccountSummary> {
    const operation = "accounts.createAccount"
    if (input.accountTypeCode === "real_estate" || input.accountTypeCode === "business") {
      const { data, error } = await this.client.rpc("create_valued_account", {
        p_account_type_code: input.accountTypeCode,
        p_name: input.name,
        p_currency_code: input.currencyCode,
        p_property_type: input.propertyType ?? null,
        p_business_type: input.businessType ?? null,
        p_industry: input.industry ?? null,
        p_ownership_percentage: input.ownershipPercentage ?? "100",
        p_location: input.location ?? null,
        p_account_notes: input.notes ?? null,
        p_valuation_amount: input.valuationAmount ?? "0",
        p_valued_on: input.valuedOn ?? new Date().toISOString().slice(0, 10),
        p_valuation_method: input.valuationMethod ?? null,
        p_valuation_notes: input.valuationNotes ?? null,
      })
      throwAccountConstraintError(error, operation)
      const createdAccount = requireQueryData(data, error, operation)
      // PostgreSQL numerics in an RPC composite return may be JSON numbers. Re-read
      // through accountSelect so all decimal fields retain the repository's string contract.
      return this.getAccount(createdAccount.id)
    }
    const userId = await requireAuthenticatedUserId(this.client, operation)
    const { data, error } = await this.client
      .from("financial_accounts")
      .insert({
        user_id: userId,
        account_type_code: input.accountTypeCode,
        name: input.name,
        currency_code: input.currencyCode,
        opening_balance: input.openingBalance,
        notes: input.notes,
        bank_subtype: input.bankSubtype,
        credit_card_limit: input.creditCardLimit,
        due_day_of_month: input.dueDayOfMonth,
        investment_type: input.investmentType,
        balance_grams: input.balanceGrams,
        property_type: input.propertyType,
        ownership_percentage: input.ownershipPercentage,
        business_type: input.businessType,
        industry: input.industry,
        location: input.location,
        metal_type: input.metalType,
        purity: input.purity,
        purchase_date: input.purchaseDate,
        cost_per_unit: input.costPerUnit,
      })
      .select(accountSelect)
      .single()

    throwAccountConstraintError(error, operation)
    return mapAccountSummary(
      requireQueryData(data, error, operation),
      operation
    )
  }

  async updateAccount(
    id: string,
    input: UpdateAccountInput
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
    if (input.openingBalance !== undefined) {
      update.opening_balance = input.openingBalance
    }
    if (input.notes !== undefined) {
      update.notes = input.notes
    }
    if (input.isActive !== undefined) {
      update.is_active = input.isActive
    }
    if (input.bankSubtype !== undefined) {
      update.bank_subtype = input.bankSubtype
    }
    if (input.creditCardLimit !== undefined) {
      update.credit_card_limit = input.creditCardLimit
    }
    if (input.dueDayOfMonth !== undefined) {
      update.due_day_of_month = input.dueDayOfMonth
    }
    if (input.investmentType !== undefined) {
      update.investment_type = input.investmentType
    }
    if (input.balanceGrams !== undefined) {
      update.balance_grams = input.balanceGrams
    }
    if (input.propertyType !== undefined) {
      update.property_type = input.propertyType
    }
    if (input.ownershipPercentage !== undefined) {
      update.ownership_percentage = input.ownershipPercentage
    }
    if (input.businessType !== undefined) {
      update.business_type = input.businessType
    }
    if (input.industry !== undefined) {
      update.industry = input.industry
    }
    if (input.location !== undefined) {
      update.location = input.location
    }
    if (input.metalType !== undefined) {
      update.metal_type = input.metalType
    }
    if (input.purity !== undefined) {
      update.purity = input.purity
    }
    if (input.purchaseDate !== undefined) {
      update.purchase_date = input.purchaseDate
    }
    if (input.costPerUnit !== undefined) {
      update.cost_per_unit = input.costPerUnit
    }

    const { data, error } = await this.client
      .from("financial_accounts")
      .update(update)
      .eq("id", id)
      .eq("user_id", userId)
      .select(accountSelect)
      .single()

    throwAccountConstraintError(error, operation)
    return mapAccountSummary(
      requireQueryData(data, error, operation),
      operation
    )
  }

  async closeAccount(id: string): Promise<AccountSummary> {
    const operation = "accounts.closeAccount"
    const { error } = await this.client.rpc("close_financial_account", {
      p_account_id: id,
    })
    requireQueryData(true, error, operation)
    return this.getAccount(id)
  }

  async reopenAccount(id: string): Promise<AccountSummary> {
    const operation = "accounts.reopenAccount"
    const { error } = await this.client.rpc("reopen_financial_account", {
      p_account_id: id,
    })
    requireQueryData(true, error, operation)
    return this.getAccount(id)
  }

  async getAccountLifecycleEligibility(
    accountIds: string[]
  ): Promise<AccountLifecycleEligibility[]> {
    const operation = "accounts.getAccountLifecycleEligibility"
    if (accountIds.length === 0) return []
    const { data, error } = await this.client.rpc(
      "get_account_lifecycle_eligibility",
      { p_account_ids: accountIds }
    )
    return requireQueryData(data, error, operation).map((row) => ({
      accountId: row.account_id,
      canClose: row.can_close,
      closeBlockReason: row.close_block_reason,
      canDelete: row.can_delete,
      deleteBlockReason: row.delete_block_reason,
      hasFinancialHistory: row.has_financial_history,
    }))
  }

  async deleteAccount(id: string): Promise<void> {
    const operation = "accounts.deleteAccount"
    const { error } = await this.client.rpc("delete_pristine_financial_account", {
      p_account_id: id,
    })
    requireQueryData(true, error, operation)
  }
}

export const accountsRepository = new AccountsRepository()
