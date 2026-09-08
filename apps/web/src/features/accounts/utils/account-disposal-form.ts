import {
  compareDecimals,
  normalizeDecimal,
} from "@/lib/financial-calculations/decimal"
import type { AccountSummary } from "@/lib/supabase/types"
import type { AccountDisposalInput } from "../types/account-disposal"

export type AccountDisposalFormState = {
  amount: string
  soldOn: string
  currency: string
  destinationAccountId: string
  ownershipSold: string
  notes: string
}

export function createAccountDisposalFormState(
  account: Pick<AccountSummary, "currency_code">,
  today = new Date().toISOString().slice(0, 10)
): AccountDisposalFormState {
  return {
    amount: "",
    soldOn: today,
    currency: account.currency_code,
    destinationAccountId: "",
    ownershipSold: "",
    notes: "",
  }
}

export function normalizeSaleAmount(value: string): string | null {
  const normalized = normalizeDecimal(value.trim())
  return normalized !== null && compareDecimals(normalized, "0") !== -1
    ? normalized
    : null
}

export function isPositiveSaleAmount(value: string): boolean {
  const normalized = normalizeSaleAmount(value)
  return normalized !== null && compareDecimals(normalized, "0") === 1
}

export type AccountDisposalSubmissionAttempt = {
  fingerprint: string
  idempotencyKey: string
}

function submissionFingerprint(input: AccountDisposalInput): string {
  return JSON.stringify([
    input.disposedOn,
    normalizeDecimal(String(input.saleAmount)),
    input.saleCurrencyCode,
    normalizeDecimal(String(input.ownershipPercentageSold)),
    input.destinationAccountId ?? null,
    input.notes?.trim() || null,
  ])
}

export function resolveAccountDisposalSubmissionAttempt(
  current: AccountDisposalSubmissionAttempt | null,
  input: AccountDisposalInput,
  generateKey: () => string = () => crypto.randomUUID()
): AccountDisposalSubmissionAttempt {
  const fingerprint = submissionFingerprint(input)
  return current?.fingerprint === fingerprint
    ? current
    : { fingerprint, idempotencyKey: generateKey() }
}
