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
  investmentType?: "stock_etf" | "crypto" | "other" | null
  balanceGrams?: Decimal | null
  propertyType?: "apartment" | "villa" | "land" | "office" | "other" | null
  ownershipPercentage?: Decimal | null
  businessType?: string | null
  industry?: string | null
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
  investmentType?: "stock_etf" | "crypto" | "other" | null
  balanceGrams?: Decimal | null
  propertyType?: "apartment" | "villa" | "land" | "office" | "other" | null
  ownershipPercentage?: Decimal | null
  businessType?: string | null
  industry?: string | null
  metalType?: "gold" | "silver" | null
  purity?: string | null
  purchaseDate?: string | null
  costPerUnit?: Decimal | null
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

const accountSelect = "id,user_id,account_type_code,name,currency_code,opening_balance::text,notes,is_active,bank_subtype,investment_type,balance_grams::text,property_type,ownership_percentage::text,business_type,industry,metal_type,purity,purchase_date,cost_per_unit::text,created_at,updated_at" as const

export function requireAccountDecimalText(value: unknown, field: string, operation: string): Decimal {
  if (typeof value !== "string" || normalizeDecimal(value) === null) {
    throw new RepositoryError({ code: "database_error", message: `Account field ${field} must be a PostgreSQL decimal string`, operation })
  }
  return value
}

function requireNullableAccountDecimalText(value: unknown, field: string, operation: string): Decimal | null {
  return value === null ? null : requireAccountDecimalText(value, field, operation)
}

function mapAccountSummary(row: AccountSummary, operation: string): AccountSummary {
  return {
    ...row,
    opening_balance: requireAccountDecimalText(row.opening_balance, "opening_balance", operation),
    balance_grams: requireNullableAccountDecimalText(row.balance_grams, "balance_grams", operation),
    ownership_percentage: requireNullableAccountDecimalText(row.ownership_percentage, "ownership_percentage", operation),
    cost_per_unit: requireNullableAccountDecimalText(row.cost_per_unit, "cost_per_unit", operation),
  }
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
      .select(accountSelect)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    return requireQueryData(data, error, operation).map((row) => mapAccountSummary(row, operation))
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

    return mapAccountSummary(requireQueryData(data, error, operation), operation)
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
        opening_balance: input.openingBalance,
        notes: input.notes,
        bank_subtype: input.bankSubtype,
        investment_type: input.investmentType,
        balance_grams: input.balanceGrams,
        property_type: input.propertyType,
        ownership_percentage: input.ownershipPercentage,
        business_type: input.businessType,
        industry: input.industry,
        metal_type: input.metalType,
        purity: input.purity,
        purchase_date: input.purchaseDate,
        cost_per_unit: input.costPerUnit,
      })
      .select(accountSelect)
      .single()

    return mapAccountSummary(requireQueryData(data, error, operation), operation)
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

    throwAccountUpdateError(error, operation)
    return mapAccountSummary(requireQueryData(data, error, operation), operation)
  }

  async archiveAccount(id: string): Promise<AccountSummary> {
    return this.updateAccount(id, { isActive: false })
  }

  async getAccountDeletionEligibility(
    accountIds: string[],
  ): Promise<AccountDeletionEligibility[]> {
    // This deployment scopes financial_accounts as a standalone table with no
    // ledger/holdings schema, so no account can carry financial history yet.
    return accountIds.map((accountId) => ({
      accountId,
      canDelete: true,
      hasFinancialHistory: false,
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
