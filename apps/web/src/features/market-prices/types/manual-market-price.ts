import type { Decimal, TableRow } from "@/lib/supabase/types"

export interface ManualMarketPriceInput {
  assetId: string
  price: Decimal
  currencyCode: string
  asOf: string
}

export type ManualMarketPrice = TableRow<"market_prices">
