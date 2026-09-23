import { normalizeDecimal } from "@/lib/financial-calculations/decimal"
import type { SubmissionAttempt } from "@/features/accounts/utils/refund-submission"
import { resolveSubmissionAttempt } from "@/features/accounts/utils/refund-submission"

const decimal = (value: string | null | undefined, zero = false) =>
  normalizeDecimal(value?.trim() || (zero ? "0" : ""))

export function brokerageTradeFingerprint(input: {
  side: "buy" | "sell"; accountId: string; assetId: string; quantity: string;
  unitPrice: string; occurredAt: string; notes: string; fees: string; accountFxRate: string | null
}) {
  return JSON.stringify([input.side,input.accountId,input.assetId,decimal(input.quantity),decimal(input.unitPrice),input.occurredAt,input.notes.trim()||null,decimal(input.fees,true),decimal(input.accountFxRate)])
}

export function brokerageDividendFingerprint(input: {
  mode: "cash" | "full" | "partial"; accountId: string; assetId: string; gross: string;
  tax: string; fees: string; occurredAt: string; notes: string; unitPrice?: string; reinvestedAmount?: string
}) {
  return JSON.stringify([input.mode,input.accountId,input.assetId,decimal(input.gross),decimal(input.tax,true),decimal(input.fees,true),input.occurredAt,input.notes.trim()||null,input.mode === "cash" ? null : decimal(input.unitPrice),input.mode === "partial" ? decimal(input.reinvestedAmount) : null])
}

export const brokerageAttempt = (current: SubmissionAttempt | null, fingerprint: string) =>
  resolveSubmissionAttempt(current, fingerprint)
