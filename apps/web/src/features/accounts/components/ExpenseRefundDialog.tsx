import { useState } from "react"
import { Dialog } from "@base-ui/react/dialog"
import { Button } from "@/components/ui/button"
import { MoneyInput } from "@/components/MoneyInput"
import { normalizeMoneyInput } from "@/lib/formatting/money-input"
import { formatPortfolioAmount } from "@/features/portfolio/utils/portfolio-formatters"
import {
  compareDecimals,
  normalizeDecimal,
  subtractDecimals,
} from "@/lib/financial-calculations/decimal"
import { formatLocalDateTimeInput } from "@/lib/formatting/local-date-time"
import { useTranslation } from "@/i18n/useTranslation"
import type { AccountSummary } from "@/lib/supabase/types"
import type { ExpenseRefundSummary } from "../types/account-record"

export function ExpenseRefundDialog({
  open,
  summary,
  accounts,
  originalAccountId,
  category,
  saving,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean
  summary: ExpenseRefundSummary | null
  accounts: AccountSummary[]
  originalAccountId: string
  category: string
  saving: boolean
  error: string | null
  onClose: () => void
  onSubmit: (values: {
    amount: string
    destinationAccountId: string
    occurredAt: string
    notes: string
  }) => Promise<void>
}) {
  const { t, language } = useTranslation()
  const locale = language === "ar" ? "ar-SA" : "en-US"
  const [amount, setAmount] = useState(() =>
    summary
      ? (normalizeDecimal(summary.remainingRefundableAmount) ??
        summary.remainingRefundableAmount)
      : ""
  )
  const [destinationAccountId, setDestinationAccountId] =
    useState(originalAccountId)
  const [occurredAt, setOccurredAt] = useState(() => formatLocalDateTimeInput())
  const [notes, setNotes] = useState("")
  if (!open || !summary) return null
  const canonicalAmount = normalizeMoneyInput(amount)
  const normalizedAmount = canonicalAmount === null ? null : normalizeDecimal(canonicalAmount)
  const remainingAfterRefund = normalizedAmount
    ? subtractDecimals(summary.remainingRefundableAmount, normalizedAmount)
    : null
  const invalid =
    !normalizedAmount ||
    (compareDecimals(normalizedAmount, "0") ?? 0) <= 0 ||
    (compareDecimals(normalizedAmount, summary.remainingRefundableAmount) ??
      1) > 0 ||
    !destinationAccountId ||
    !occurredAt
  const formattedAmount = (value: string | null) =>
    value === null
      ? "—"
      : formatPortfolioAmount(value, summary.currencyCode, locale)
  return (
    <Dialog.Root open onOpenChange={(next) => !next && !saving && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[130] bg-black/40" />
        <Dialog.Popup
          className="fixed inset-x-4 top-1/2 z-[140] mx-auto w-full max-w-lg -translate-y-1/2 rounded-2xl bg-[var(--color-surface)] p-5 shadow-xl"
          dir={language === "ar" ? "rtl" : "ltr"}
        >
          <Dialog.Title className="text-lg font-semibold">
            {t("accounts.records.recordRefund")}
          </Dialog.Title>
          <div className="mt-4 grid gap-3 text-sm">
            <p>
              {t("accounts.records.category")}: {category}
            </p>
            <p dir="ltr">
              {t("accounts.records.originalAmount")}:{" "}
              {formattedAmount(summary.originalAmount)}
            </p>
            <p dir="ltr">
              {t("accounts.records.refunded")}:{" "}
              {formattedAmount(summary.effectiveRefundedAmount)}
            </p>
            <p dir="ltr">
              {t("accounts.records.remainingRefundable")}:{" "}
              {formattedAmount(summary.remainingRefundableAmount)}
            </p>
            <label>
              {t("accounts.records.refundAmount")}
              <MoneyInput
                className="mt-1 w-full rounded-xl border p-2"
                dir="ltr"
                value={amount}
                onValueChange={setAmount}
              />
            </label>
            <div className="rounded-xl bg-[var(--color-surface-muted)] p-3 text-sm">
              <p dir="ltr">
                {t("accounts.records.currentRefundAmount")}:{" "}
                {formattedAmount(normalizedAmount)}
              </p>
              <p dir="ltr">
                {t("accounts.records.remainingAfterRefund")}:{" "}
                {formattedAmount(remainingAfterRefund)}
              </p>
            </div>
            <label>
              {t("accounts.records.toAccount")}
              <select
                className="mt-1 w-full rounded-xl border p-2"
                value={destinationAccountId}
                onChange={(e) => setDestinationAccountId(e.target.value)}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.currency_code}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("accounts.records.dateTime")}
              <input
                className="mt-1 w-full rounded-xl border p-2"
                dir="ltr"
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
              />
            </label>
            <label>
              {t("accounts.records.notes")}
              <textarea
                className="mt-1 w-full rounded-xl border p-2"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="text-red-600">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={saving}
                onClick={onClose}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                disabled={saving || invalid}
                onClick={() =>
                  void onSubmit({
                    amount: normalizedAmount ?? amount,
                    destinationAccountId,
                    occurredAt,
                    notes,
                  })
                }
              >
                {t("accounts.records.recordRefund")}
              </Button>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
