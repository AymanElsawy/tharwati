export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Decimal = string
export type QuantityUnit =
  | "shares"
  | "grams"
  | "kilograms"
  | "troy_ounces"
  | "coins"
  | "property"
  | "ownership_units"
  | "currency_amount"
  | "units"

type TableDefinition<
  Row,
  Insert,
  Update = Partial<Insert>,
  Relationships extends DatabaseRelationship[] = [],
> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: Relationships
}

type DatabaseRelationship = {
  foreignKeyName: string
  columns: string[]
  isOneToOne: boolean
  referencedRelation: string
  referencedColumns: string[]
}

type CurrencyRow = {
  code: string
  name: string
  symbol: string | null
  decimal_places: number
  is_active: boolean
  created_at: string
}

type ProfileRow = {
  id: string
  display_name: string | null
  full_name: string | null
  avatar_url: string | null
  default_currency_code: string
  country_code: string | null
  selected_goals: string[]
  onboarding_completed: boolean
  timezone: string
  created_at: string
  updated_at: string
}

type FinancialSettingsRow = {
  id: string
  user_id: string
  reporting_currency_code: string
  retirement_target_amount: Decimal | null
  retirement_target_date: string | null
  monthly_contribution_target: Decimal | null
  created_at: string
  updated_at: string
}

type ExchangeRateRow = {
  id: string
  user_id: string | null
  base_currency_code: string
  quote_currency_code: string
  rate: Decimal
  effective_at: string
  source: string | null
  created_at: string
  updated_at: string
}

type MarketPriceRow = {
  id: string
  user_id: string | null
  asset_id: string
  provider: string
  price: Decimal
  currency_code: string
  as_of: string
  created_at: string
  updated_at: string
}

type AccountTypeRow = {
  code: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
}

type FinancialAccountRow = {
  id: string
  user_id: string
  account_type_code: string
  name: string
  institution_name: string | null
  currency_code: string
  opening_balance: Decimal
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

type AssetTypeRow = {
  code: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
}

type AssetRow = {
  id: string
  user_id: string | null
  asset_type_code: string
  symbol: string | null
  name: string
  currency_code: string
  exchange: string | null
  is_custom: boolean
  is_active: boolean
  canonical_quantity_unit: QuantityUnit
  created_at: string
  updated_at: string
}

type AssetIdentifierRow = {
  id: string
  asset_id: string
  user_id: string | null
  scheme:
    | "isin"
    | "ticker"
    | "crypto_native"
    | "crypto_contract"
    | "commodity"
    | "precious_metal"
    | "custom_real_estate"
    | "custom_business"
    | "provider"
  namespace: string
  value: string
  normalized_value: string
  provider: string | null
  is_primary: boolean
  created_at: string
  updated_at: string
}

type HoldingRow = {
  id: string
  user_id: string
  account_id: string
  asset_id: string
  quantity: Decimal
  average_cost: Decimal | null
  total_cost_basis: Decimal
  cost_currency_code: string
  notes: string | null
  created_at: string
  updated_at: string
}

type TransactionTypeRow = {
  code: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
}

type FinancialTransactionRow = {
  id: string
  user_id: string
  transaction_type_code: string
  transaction_currency_code: string
  status: "draft" | "posted"
  occurred_at: string
  description: string
  external_reference: string | null
  notes: string | null
  posted_at: string | null
  created_at: string
  updated_at: string
}

type TransactionEntryRow = {
  id: string
  transaction_id: string
  user_id: string
  account_id: string
  asset_id: string | null
  entry_side: "debit" | "credit"
  transaction_amount: Decimal
  account_amount: Decimal
  quantity_delta: Decimal | null
  input_quantity: Decimal | null
  input_quantity_unit: QuantityUnit | null
  quantity_conversion_factor: Decimal | null
  cost_basis_delta: Decimal | null
  account_cost_basis_delta: Decimal | null
  account_fx_rate: Decimal | null
  account_fx_effective_at: string | null
  account_fx_source: string | null
  unit_price: Decimal | null
  memo: string | null
  created_at: string
  updated_at: string
}

export type Database = {
  public: {
    Tables: {
      currencies: TableDefinition<
        CurrencyRow,
        {
          code: string
          name: string
          symbol?: string | null
          decimal_places?: number
          is_active?: boolean
          canonical_quantity_unit?: QuantityUnit
          created_at?: string
        }
      >
      profiles: TableDefinition<
        ProfileRow,
        {
          id: string
          display_name?: string | null
          full_name?: string | null
          avatar_url?: string | null
          default_currency_code?: string
          country_code?: string | null
          selected_goals?: string[]
          onboarding_completed?: boolean
          timezone?: string
          created_at?: string
          updated_at?: string
        }
      >
      financial_settings: TableDefinition<
        FinancialSettingsRow,
        {
          id?: string
          user_id: string
          reporting_currency_code?: string
          retirement_target_amount?: Decimal | null
          retirement_target_date?: string | null
          monthly_contribution_target?: Decimal | null
          created_at?: string
          updated_at?: string
        }
      >
      exchange_rates: TableDefinition<
        ExchangeRateRow,
        {
          id?: string
          user_id: string
          base_currency_code: string
          quote_currency_code: string
          rate: Decimal
          effective_at: string
          source?: string | null
          created_at?: string
          updated_at?: string
        }
      >
      market_prices: TableDefinition<
        MarketPriceRow,
        {
          id?: string
          user_id?: string | null
          asset_id: string
          provider: string
          price: Decimal
          currency_code: string
          as_of: string
          created_at?: string
          updated_at?: string
        }
      >
      account_types: TableDefinition<
        AccountTypeRow,
        {
          code: string
          name: string
          description?: string | null
          is_active?: boolean
          created_at?: string
        }
      >
      financial_accounts: TableDefinition<
        FinancialAccountRow,
        {
          id?: string
          user_id: string
          account_type_code: string
          name: string
          institution_name?: string | null
          currency_code: string
          opening_balance?: Decimal
          is_active?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      >
      asset_types: TableDefinition<
        AssetTypeRow,
        {
          code: string
          name: string
          description?: string | null
          is_active?: boolean
          created_at?: string
        }
      >
      assets: TableDefinition<
        AssetRow,
        {
          id?: string
          user_id?: string | null
          asset_type_code: string
          symbol?: string | null
          name: string
          currency_code: string
          exchange?: string | null
          is_custom?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      >
      asset_identifiers: TableDefinition<
        AssetIdentifierRow,
        {
          id?: string
          asset_id: string
          user_id?: string | null
          scheme: AssetIdentifierRow["scheme"]
          namespace: string
          value: string
          normalized_value: string
          provider?: string | null
          is_primary?: boolean
          created_at?: string
          updated_at?: string
        }
      >
      holdings: TableDefinition<
        HoldingRow,
        {
          id?: string
          user_id: string
          account_id: string
          asset_id: string
          quantity?: Decimal
          average_cost?: Decimal | null
          total_cost_basis?: Decimal
          cost_currency_code: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        },
        Partial<{
          id?: string
          user_id: string
          account_id: string
          asset_id: string
          quantity?: Decimal
          average_cost?: Decimal | null
          total_cost_basis?: Decimal
          cost_currency_code: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }>,
        [
          {
            foreignKeyName: "holdings_account_id_financial_accounts_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holdings_asset_id_assets_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      >
      transaction_types: TableDefinition<
        TransactionTypeRow,
        {
          code: string
          name: string
          description?: string | null
          is_active?: boolean
          created_at?: string
        }
      >
      financial_transactions: TableDefinition<
        FinancialTransactionRow,
        {
          id?: string
          user_id: string
          transaction_type_code: string
          transaction_currency_code: string
          status?: "draft" | "posted"
          occurred_at?: string
          description: string
          external_reference?: string | null
          notes?: string | null
          posted_at?: string | null
          created_at?: string
          updated_at?: string
        }
      >
      transaction_entries: TableDefinition<
        TransactionEntryRow,
        {
          id?: string
          transaction_id: string
          user_id: string
          account_id: string
          asset_id?: string | null
          entry_side: "debit" | "credit"
          transaction_amount: Decimal
          account_amount: Decimal
          quantity_delta?: Decimal | null
          input_quantity?: Decimal | null
          input_quantity_unit?: QuantityUnit | null
          quantity_conversion_factor?: Decimal | null
          cost_basis_delta?: Decimal | null
          account_cost_basis_delta?: Decimal | null
          account_fx_rate?: Decimal | null
          account_fx_effective_at?: string | null
          account_fx_source?: string | null
          unit_price?: Decimal | null
          memo?: string | null
          created_at?: string
          updated_at?: string
        },
        Partial<{
          id?: string
          transaction_id: string
          user_id: string
          account_id: string
          asset_id?: string | null
          entry_side: "debit" | "credit"
          transaction_amount: Decimal
          account_amount: Decimal
          quantity_delta?: Decimal | null
          input_quantity?: Decimal | null
          input_quantity_unit?: QuantityUnit | null
          quantity_conversion_factor?: Decimal | null
          cost_basis_delta?: Decimal | null
          account_cost_basis_delta?: Decimal | null
          account_fx_rate?: Decimal | null
          account_fx_effective_at?: string | null
          account_fx_source?: string | null
          unit_price?: Decimal | null
          memo?: string | null
          created_at?: string
          updated_at?: string
        }>,
        [
          {
            foreignKeyName: "transaction_entries_transaction_id_financial_transactions_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
        ]
      >
    }
    Views: Record<never, never>
    Functions: {
      complete_onboarding: {
        Args: {
          p_country_code: string
          p_base_currency_code: string
          p_selected_goals: string[]
        }
        Returns: undefined
      }
      get_account_balances: {
        Args: {
          p_account_ids?: string[] | null
        }
        Returns: Array<{
          account_id: string
          account_type_code: string
          account_name: string
          currency_code: string
          is_active: boolean
          opening_balance: Decimal
          ledger_effect: Decimal
          current_balance: Decimal
        }>
      }
      get_current_market_price: {
        Args: {
          p_asset_id: string
        }
        Returns: MarketPriceRow[]
      }
      post_transaction: {
        Args: { transaction_id: string }
        Returns: FinancialTransactionRow
      }
      add_investment: {
        Args: {
          p_account_id: string | null
          p_new_account_type_code: string | null
          p_new_account_name: string | null
          p_new_account_currency_code: string | null
          p_new_account_institution_name: string | null
          p_asset_id: string | null
          p_new_asset_type_code: string | null
          p_new_asset_name: string | null
          p_new_asset_symbol: string | null
          p_new_asset_currency_code: string | null
          p_new_asset_exchange: string | null
          p_identifier_scheme: string | null
          p_identifier_namespace: string | null
          p_identifier_value: string | null
          p_identifier_provider: string | null
          p_quantity: Decimal
          p_unit_price: Decimal
          p_fees: Decimal | null
          p_occurred_at: string
          p_notes: string | null
        }
        Returns: Json
      }
      resolve_historical_exchange_rate: {
        Args: {
          p_source_currency_code: string
          p_destination_currency_code: string
          p_requested_at: string
        }
        Returns: Array<{
          rate: Decimal
          effective_at: string
          source: string | null
          direction: "direct" | "inverse"
        }>
      }
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}

export type TableName = keyof Database["public"]["Tables"]
export type TableRow<Name extends TableName> =
  Database["public"]["Tables"][Name]["Row"]
export type TableInsert<Name extends TableName> =
  Database["public"]["Tables"][Name]["Insert"]
export type TableUpdate<Name extends TableName> =
  Database["public"]["Tables"][Name]["Update"]

export type AccountSummary = TableRow<"financial_accounts">
export type AssetSummary = TableRow<"assets">

export type TransactionDraft = {
  transactionTypeCode: string
  transactionCurrencyCode: string
  description: string
  occurredAt?: string
  externalReference?: string | null
  notes?: string | null
}

export type TransactionEntryInput = {
  accountId: string
  assetId?: string | null
  entrySide: "debit" | "credit"
  transactionAmount: Decimal
  accountAmount: Decimal
  quantityDelta?: Decimal | null
  unitPrice?: Decimal | null
  memo?: string | null
}

export type TransactionDetails = {
  transaction: TableRow<"financial_transactions">
  entries: TableRow<"transaction_entries">[]
}

export type RepositoryErrorCode =
  | "authentication_required"
  | "not_found"
  | "conflict"
  | "constraint_violation"
  | "forbidden"
  | "database_error"

type SupabaseErrorLike = {
  code?: string
  message: string
  details?: string
  hint?: string
}

export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode
  readonly operation: string
  readonly details?: string
  readonly hint?: string

  constructor(options: {
    code: RepositoryErrorCode
    message: string
    operation: string
    details?: string
    hint?: string
    cause?: unknown
  }) {
    super(options.message, { cause: options.cause })
    this.name = "RepositoryError"
    this.code = options.code
    this.operation = options.operation
    this.details = options.details
    this.hint = options.hint
  }
}

export function toRepositoryError(
  error: SupabaseErrorLike,
  operation: string,
): RepositoryError {
  const codeByDatabaseCode: Record<string, RepositoryErrorCode> = {
    "23503": "constraint_violation",
    "23505": "conflict",
    "23514": "constraint_violation",
    "42501": "forbidden",
    PGRST116: "not_found",
  }

  return new RepositoryError({
    code: codeByDatabaseCode[error.code ?? ""] ?? "database_error",
    message: error.message,
    operation,
    details: error.details,
    hint: error.hint,
    cause: error,
  })
}
