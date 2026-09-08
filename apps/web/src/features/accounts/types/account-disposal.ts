import type { Decimal } from "@/lib/supabase/types"

export type AccountDisposal = {
  id: string
  accountId: string
  disposedOn: string
  saleAmount: Decimal
  saleCurrencyCode: string
  ownershipPercentageSold: Decimal
  notes: string | null
  correctsDisposalId: string | null
  idempotencyKey: string | null
  proceedsAccountId: string | null
  proceedsTransactionId: string | null
  createdAt: string
  isEffective: boolean
}

export type AccountDisposalInput = {
  disposedOn: string
  saleAmount: Decimal
  saleCurrencyCode: string
  ownershipPercentageSold: Decimal
  destinationAccountId?: string | null
  notes?: string | null
}

export type AddAccountDisposalInput = AccountDisposalInput & {
  idempotencyKey: string
}

export type AccountOwnershipProjection = {
  accountId: string
  ownershipPercentage: Decimal | null
  isSold: boolean
}
