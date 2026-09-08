import type { Decimal } from "@/lib/supabase/types"

export type AccountValuation = {
  id: string
  accountId: string
  valuationAmount: Decimal
  valuedOn: string
  valuationMethod: string | null
  notes: string | null
  correctsValuationId: string | null
  createdAt: string
}

export type AccountValuationInput = {
  valuationAmount: Decimal
  valuedOn: string
  valuationMethod?: string | null
  notes?: string | null
}
