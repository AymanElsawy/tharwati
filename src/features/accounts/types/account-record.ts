import type { Decimal } from "@/lib/supabase/types"

export type AccountRecord = {
  id: string
  occurredAt: string
  type: string
  description: string
  amount: Decimal
  currencyCode: string
}
