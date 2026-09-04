import type { Json } from "@/lib/supabase/types"

export const USER_DATA_EXPORT_SCHEMA = "tharwati.user-data-export" as const
export const USER_DATA_EXPORT_VERSION = 1 as const

export type SafeAuthAccount = {
  id: string
  email: string | null
  phone: string | null
  created_at: string
  updated_at: string | null
  last_sign_in_at: string | null
}

export type UserDataExportData = {
  auth_account: SafeAuthAccount
  profile: Json
  financial_accounts: Json[]
  financial_transactions: Json[]
  transaction_entries: Json[]
  holdings: Json[]
  user_assets: Json[]
  asset_identifiers: Json[]
  metal_purchases: Json[]
  metal_purchase_lifecycle_events: Json[]
  account_valuations: Json[]
  account_disposals: Json[]
  record_categories: Json[]
  record_category_overrides: Json[]
  goals: Json[]
  goal_progress_entries: Json[]
  manual_market_prices: Json[]
}

export type UserDataExportV1 = {
  schema: typeof USER_DATA_EXPORT_SCHEMA
  version: typeof USER_DATA_EXPORT_VERSION
  generated_at: string
  subject: { user_id: string }
  data: UserDataExportData
}
