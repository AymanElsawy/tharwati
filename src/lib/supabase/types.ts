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
  full_name: string | null
  avatar_url: string | null
  country_code: string | null
  base_currency_code: string | null
  selected_goals: string[]
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

export type GoalType = "buy_home" | "buy_car" | "travel" | "education" | "other"
export type GoalStatus = "active" | "completed" | "cancelled"
export type GoalEntryType = "progress" | "withdrawal" | "reversal"
export type GoalRow = {
  id: string
  user_id: string
  name: string
  goal_type: GoalType
  custom_type_name: string | null
  target_amount: Decimal
  currency_code: string
  target_date: string | null
  status: GoalStatus
  archived_at: string | null
  created_at: string
  updated_at: string
}
export type GoalProgressEntryRow = {
  id: string
  goal_id: string
  user_id: string
  entry_type: GoalEntryType
  amount: Decimal
  effective_on: string
  note: string | null
  reverses_entry_id: string | null
  created_at: string
  replacement_for_entry_id: string | null
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
  provider: string | null
  fetched_at: string | null
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
  fetched_at: string
  price_type: "realtime" | "delayed" | "previous_close" | "stale" | "manual"
  created_at: string
  updated_at: string
}

type DashboardValuationSnapshotRow = {
  user_id: string
  base_currency_code: string
  snapshot: Json
  as_of: string
  expires_at: string
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
  currency_code: string
  opening_balance: Decimal
  is_active: boolean
  notes: string | null
  bank_subtype: "debit" | "credit" | null
  credit_card_limit: Decimal | null
  due_day_of_month: number | null
  investment_type: "stock_etf" | "crypto" | "other" | null
  balance_grams: Decimal | null
  property_type: "apartment" | "villa" | "land" | "office" | "other" | null
  ownership_percentage: Decimal | null
  initial_ownership_percentage?: Decimal | null
  closed_on?: string | null
  closed_reason?: "sold" | null
  business_type: string | null
  industry: string | null
  location?: string | null
  metal_type: "gold" | "silver" | null
  purity: string | null
  purchase_date: string | null
  cost_per_unit: Decimal | null
  created_at: string
  updated_at: string
}

type MetalPurchaseRow = {
  id: string
  user_id: string
  account_id: string
  purity: string
  purchased_at: string
  quantity_grams: Decimal
  cost_per_unit: Decimal
  fees: Decimal
  notes: string | null
  funding_mode: "external" | "cash_account"
  funding_account_id: string | null
  funding_transaction_id: string | null
  created_at: string
}

type AccountValuationRow = {
  id: string
  user_id: string
  account_id: string
  valuation_amount: Decimal
  valued_on: string
  valuation_method: string | null
  notes: string | null
  corrects_valuation_id: string | null
  created_at: string
}

type AccountDisposalRow = {
  id: string
  user_id: string
  account_id: string
  disposed_on: string
  sale_amount: Decimal
  sale_currency_code: string
  ownership_percentage_sold: Decimal
  notes: string | null
  corrects_disposal_id: string | null
  created_at: string
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

type RecordCategoryRow = {
  id: string
  user_id: string | null
  parent_id: string | null
  system_code: string | null
  level: "main" | "subcategory"
  name: string
  sort_order: number
  is_archived: boolean
  created_at: string
  updated_at: string
}

type RecordCategoryOverrideRow = {
  user_id: string
  category_id: string
  name: string | null
  is_hidden: boolean
  created_at: string
  updated_at: string
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
  main_category_id: string | null
  subcategory_id: string | null
  posted_at: string | null
  created_at: string
  updated_at: string
  reverses_transaction_id?: string | null
  corrects_transaction_id?: string | null
}

type TransactionEntryRow = {
  id: string
  transaction_id: string
  user_id: string
  account_id: string | null
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
  purity: string | null
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
          full_name?: string | null
          avatar_url?: string | null
          country_code?: string | null
          base_currency_code?: string | null
          selected_goals?: string[]
          onboarding_completed?: boolean
          created_at?: string
          updated_at?: string
        }
      >
      goals: TableDefinition<
        GoalRow,
        {
          id?: string
          user_id: string
          name: string
          goal_type: GoalType
          custom_type_name?: string | null
          target_amount: Decimal
          currency_code: string
          target_date?: string | null
          status?: GoalStatus
          archived_at?: string | null
          created_at?: string
          updated_at?: string
        }
      >
      goal_progress_entries: TableDefinition<
        GoalProgressEntryRow,
        {
          id?: string
          goal_id: string
          user_id: string
          entry_type: GoalEntryType
          amount: Decimal
          effective_on: string
          note?: string | null
          reverses_entry_id?: string | null
          created_at?: string
          replacement_for_entry_id?: string | null
        }
      >
      financial_settings: TableDefinition<
        FinancialSettingsRow,
        {
          id?: string
          user_id?: string | null
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
          provider?: string | null
          fetched_at?: string | null
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
          fetched_at?: string
          price_type?:
            "realtime" | "delayed" | "previous_close" | "stale" | "manual"
          created_at?: string
          updated_at?: string
        }
      >
      dashboard_valuation_snapshots: TableDefinition<
        DashboardValuationSnapshotRow,
        {
          user_id: string
          base_currency_code: string
          snapshot: Json
          as_of: string
          expires_at: string
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
          currency_code: string
          opening_balance?: Decimal
          is_active?: boolean
          notes?: string | null
          bank_subtype?: "debit" | "credit" | null
          credit_card_limit?: Decimal | null
          due_day_of_month?: number | null
          investment_type?: "stock_etf" | "crypto" | "other" | null
          balance_grams?: Decimal | null
          property_type?:
            "apartment" | "villa" | "land" | "office" | "other" | null
          ownership_percentage?: Decimal | null
          business_type?: string | null
          industry?: string | null
          location?: string | null
          metal_type?: "gold" | "silver" | null
          purity?: string | null
          purchase_date?: string | null
          cost_per_unit?: Decimal | null
          created_at?: string
          updated_at?: string
        }
      >
      metal_purchases: TableDefinition<
        MetalPurchaseRow,
        {
          id?: string
          user_id: string
          account_id: string
          purity: string
          purchased_at: string
          quantity_grams: Decimal
          cost_per_unit: Decimal
          fees?: Decimal
          notes?: string | null
          funding_mode: "external" | "cash_account"
          funding_account_id?: string | null
          funding_transaction_id?: string | null
          created_at?: string
        }
      >
      account_valuations: TableDefinition<
        AccountValuationRow,
        {
          id?: string
          user_id: string
          account_id: string
          valuation_amount: Decimal
          valued_on: string
          valuation_method?: string | null
          notes?: string | null
          corrects_valuation_id?: string | null
          created_at?: string
        }
      >
      account_disposals: TableDefinition<
        AccountDisposalRow,
        {
          id?: string
          user_id: string
          account_id: string
          disposed_on: string
          sale_amount: Decimal
          sale_currency_code: string
          ownership_percentage_sold: Decimal
          notes?: string | null
          corrects_disposal_id?: string | null
          created_at?: string
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
          account_id?: string | null
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
          account_id?: string | null
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
      record_categories: TableDefinition<
        RecordCategoryRow,
        {
          id?: string
          user_id?: string | null
          parent_id?: string | null
          system_code?: string | null
          level: "main" | "subcategory"
          name: string
          sort_order: number
          is_archived?: boolean
          created_at?: string
          updated_at?: string
        }
      >
      record_category_overrides: TableDefinition<
        RecordCategoryOverrideRow,
        {
          user_id: string
          category_id: string
          name?: string | null
          is_hidden?: boolean
          created_at?: string
          updated_at?: string
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
          main_category_id?: string | null
          subcategory_id?: string | null
          reverses_transaction_id?: string | null
          corrects_transaction_id?: string | null
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
          account_id?: string | null
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
          purity?: string | null
          created_at?: string
          updated_at?: string
        },
        Partial<{
          id?: string
          transaction_id: string
          user_id: string
          account_id?: string | null
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
          purity?: string | null
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
      create_goal: {
        Args: {
          p_name: string
          p_goal_type: GoalType
          p_custom_type_name?: string | null
          p_target_amount: Decimal
          p_currency_code: string
          p_target_date?: string | null
          p_saved_so_far?: Decimal | null
          p_saved_on?: string | null
        }
        Returns: string
      }
      update_goal: {
        Args: {
          p_goal_id: string
          p_name: string
          p_goal_type: GoalType
          p_custom_type_name?: string | null
          p_target_amount: Decimal
          p_currency_code: string
          p_target_date?: string | null
        }
        Returns: undefined
      }
      add_goal_progress_entry: {
        Args: {
          p_goal_id: string
          p_entry_type: "progress" | "withdrawal"
          p_amount: Decimal
          p_effective_on: string
          p_note?: string | null
        }
        Returns: string
      }
      correct_goal_progress_entry: {
        Args: {
          p_entry_id: string
          p_replacement_amount?: Decimal | null
          p_replacement_effective_on?: string | null
          p_note?: string | null
        }
        Returns: string | null
      }
      set_goal_status: {
        Args: { p_goal_id: string; p_status: GoalStatus }
        Returns: undefined
      }
      set_goal_archived: {
        Args: { p_goal_id: string; p_archived: boolean }
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
      get_effective_account_valuations: {
        Args: { p_account_ids?: string[] | null }
        Returns: Array<AccountValuationRow>
      }
      get_account_current_ownership: {
        Args: { p_account_ids?: string[] | null }
        Returns: Array<{ account_id: string; ownership_percentage: Decimal | null; is_sold: boolean }>
      }
      get_account_lifecycle_eligibility: {
        Args: { p_account_ids?: string[] | null }
        Returns: Array<{
          account_id: string
          can_close: boolean
          close_block_reason: string | null
          can_delete: boolean
          delete_block_reason: string | null
          has_financial_history: boolean
        }>
      }
      close_financial_account: { Args: { p_account_id: string }; Returns: string }
      reopen_financial_account: { Args: { p_account_id: string }; Returns: string }
      delete_pristine_financial_account: { Args: { p_account_id: string }; Returns: string }
      get_account_disposals: {
        Args: { p_account_ids?: string[] | null }
        Returns: Array<AccountDisposalRow & { is_effective: boolean }>
      }
      add_account_valuation: {
        Args: { p_account_id: string; p_valuation_amount: Decimal; p_valued_on: string; p_valuation_method?: string | null; p_notes?: string | null }
        Returns: AccountValuationRow
      }
      correct_account_valuation: {
        Args: { p_valuation_id: string; p_valuation_amount: Decimal; p_valued_on: string; p_valuation_method?: string | null; p_notes?: string | null }
        Returns: AccountValuationRow
      }
      add_account_disposal: {
        Args: { p_account_id: string; p_disposed_on: string; p_sale_amount: Decimal; p_sale_currency_code: string; p_ownership_percentage_sold: Decimal; p_notes?: string | null }
        Returns: AccountDisposalRow
      }
      correct_account_disposal: {
        Args: { p_disposal_id: string; p_disposed_on: string; p_sale_amount: Decimal; p_sale_currency_code: string; p_ownership_percentage_sold: Decimal; p_notes?: string | null }
        Returns: AccountDisposalRow
      }
      create_valued_account: {
        Args: { p_account_type_code: string; p_name: string; p_currency_code: string; p_property_type: string | null; p_business_type: string | null; p_industry: string | null; p_ownership_percentage: Decimal; p_location: string | null; p_account_notes: string | null; p_valuation_amount: Decimal; p_valued_on: string; p_valuation_method: string | null; p_valuation_notes: string | null }
        Returns: FinancialAccountRow
      }
      store_dashboard_valuation_snapshot: {
        Args: {
          p_base_currency_code: string
          p_snapshot: Json
          p_as_of: string
          p_expires_at: string
        }
        Returns: Json
      }
      get_brokerage_available_cash: {
        Args: {
          p_account_id: string
          p_required_cash?: Decimal | null
          p_lock_account?: boolean | null
        }
        Returns: Decimal
      }
      add_brokerage_cash_transfer: {
        Args: {
          p_source_account_id: string
          p_destination_account_id: string
          p_amount: Decimal
          p_received_amount: Decimal | null
          p_occurred_at: string
          p_notes?: string | null
        }
        Returns: Json
      }
      reverse_brokerage_cash_transfer: {
        Args: { p_transaction_id: string }
        Returns: Json
      }
      add_existing_holding: {
        Args: {
          p_account_id: string
          p_asset_id: string
          p_quantity: Decimal
          p_average_cost: Decimal
          p_occurred_at?: string | null
          p_notes?: string | null
          p_account_fx_rate?: Decimal | null
        }
        Returns: Json
      }
      correct_existing_holding: {
        Args: {
          p_original_transaction_id: string
          p_quantity: Decimal
          p_average_cost: Decimal
          p_occurred_at: string
          p_notes: string | null
          p_account_fx_rate: Decimal | null
        }
        Returns: Json
      }
      add_brokerage_buy: {
        Args: {
          p_account_id: string
          p_asset_id: string
          p_quantity: Decimal
          p_unit_price: Decimal
          p_occurred_at?: string | null
          p_notes?: string | null
          p_fees?: Decimal | null
          p_account_fx_rate?: Decimal | null
        }
        Returns: Json
      }
      add_brokerage_sell: {
        Args: {
          p_account_id: string
          p_asset_id: string
          p_quantity: Decimal
          p_unit_sale_price: Decimal
          p_occurred_at?: string | null
          p_notes?: string | null
          p_fees?: Decimal | null
          p_account_fx_rate?: Decimal | null
        }
        Returns: Json
      }
      add_brokerage_cash_dividend: {
        Args: { p_account_id: string; p_asset_id: string; p_gross_dividend: Decimal; p_withholding_tax?: Decimal | null; p_fees?: Decimal | null; p_occurred_at?: string | null; p_notes?: string | null }
        Returns: Json
      }
      add_brokerage_dividend_reinvestment: { Args: { p_account_id: string; p_asset_id: string; p_gross_dividend: Decimal; p_withholding_tax?: Decimal | null; p_fees?: Decimal | null; p_unit_price: Decimal; p_occurred_at?: string | null; p_notes?: string | null }; Returns: Json }
      add_brokerage_partial_dividend_reinvestment: { Args: { p_account_id: string; p_asset_id: string; p_gross_dividend: Decimal; p_withholding_tax?: Decimal | null; p_fees?: Decimal | null; p_reinvested_amount: Decimal; p_unit_price: Decimal; p_occurred_at?: string | null; p_notes?: string | null }; Returns: Json }
      reverse_existing_holding: {
        Args: { p_transaction_id: string }
        Returns: Json
      }
      resolve_external_brokerage_asset: {
        Args: {
          p_symbol: string
          p_name: string
          p_mic_code: string
          p_display_exchange: string
          p_country: string
          p_currency_code: string
          p_instrument_type: string
        }
        Returns: AssetRow
      }
      get_account_record_history: {
        Args: {
          p_account_id: string
          p_cursor_occurred_at?: string | null
          p_cursor_id?: string | null
          p_page_size?: number | null
          p_time_zone?: string | null
          p_search?: string | null
          p_from_date?: string | null
          p_to_date?: string | null
          p_record_type?: string | null
          p_main_category_id?: string | null
          p_subcategory_id?: string | null
          p_min_amount?: Decimal | null
          p_max_amount?: Decimal | null
        }
        Returns: Array<{
          id: string
          occurred_at: string
          transaction_type_code: string
          description: string
          notes: string | null
          main_category_id: string | null
          subcategory_id: string | null
          account_id: string
          entry_side: "debit" | "credit"
          account_amount: Decimal
          currency_code: string
          local_date: string
          daily_net: Decimal
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
          p_funding_mode: "external" | "cash_account"
          p_funding_account_id: string | null
          p_quantity: Decimal
          p_unit_price: Decimal
          p_fees: Decimal | null
          p_occurred_at: string
          p_notes: string | null
        }
        Returns: Json
      }
      add_metal_purchase: {
        Args: {
          p_account_id: string
          p_purity: string
          p_occurred_at: string
          p_quantity_grams: Decimal
          p_cost_per_unit: Decimal
          p_funding_mode: "external" | "cash_account"
          p_funding_account_id: string | null
          p_fees: Decimal
          p_notes: string | null
        }
        Returns: Json
      }
      get_effective_metal_purchases: {
        Args: { p_account_ids?: string[] | null }
        Returns: MetalPurchaseRow[]
      }
      reverse_metal_purchase: {
        Args: { p_purchase_id: string }
        Returns: Json
      }
      correct_metal_purchase: {
        Args: {
          p_purchase_id: string
          p_purity: string
          p_occurred_at: string
          p_quantity_grams: Decimal
          p_cost_per_unit: Decimal
          p_funding_mode: "external" | "cash_account"
          p_funding_account_id: string | null
          p_fees: Decimal
          p_notes?: string | null
        }
        Returns: Json
      }
      add_account_record: {
        Args: {
          p_record_type: "income" | "expense" | "transfer"
          p_account_id: string
          p_counterparty_account_id: string | null
          p_amount: Decimal
          p_received_amount: Decimal | null
          p_occurred_at: string
          p_category: string | null
          p_notes: string | null
          p_main_category_id?: string | null
          p_subcategory_id?: string | null
        }
        Returns: Json
      }
      reverse_account_record: {
        Args: { p_transaction_id: string }
        Returns: Json
      }
      correct_account_record: {
        Args: {
          p_transaction_id: string
          p_record_type: "income" | "expense" | "transfer"
          p_account_id: string
          p_counterparty_account_id: string | null
          p_amount: Decimal
          p_received_amount: Decimal | null
          p_occurred_at: string
          p_category: string | null
          p_notes: string | null
          p_main_category_id?: string | null
          p_subcategory_id?: string | null
        }
        Returns: Json
      }
      edit_investment: {
        Args: {
          p_transaction_id: string
          p_quantity: Decimal
          p_unit_price: Decimal
          p_fees: Decimal
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
export type MetalPurchaseRecord = TableRow<"metal_purchases">

export type TransactionDraft = {
  transactionTypeCode: string
  transactionCurrencyCode: string
  description: string
  occurredAt?: string
  externalReference?: string | null
  notes?: string | null
}

export type TransactionEntryInput = {
  accountId: string | null
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
  operation: string
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
