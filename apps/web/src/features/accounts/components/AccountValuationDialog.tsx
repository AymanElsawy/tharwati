import { createFingerprint } from "../utils/create-submission"
import { resolveSubmissionAttempt, type SubmissionAttempt } from "../utils/refund-submission"
import { runMutationThenRefresh } from "@/lib/mutations/mutation-refresh"
import { Dialog } from "@base-ui/react/dialog"
import { X } from "lucide-react"
import { useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { MoneyInput } from "@/components/MoneyInput"
import { normalizeMoneyInput } from "@/lib/formatting/money-input"
import { addAccountValuation } from "@/features/accounts/services/account-valuations.service"
import {
  toStoredValuationMethod,
  valuationMethodOptionsByAccountType,
  type ValuationAccountTypeCode,
  type ValuationMethodCode,
} from "@/features/accounts/types/valuation-method"
import { useTranslation } from "@/i18n/useTranslation"
import type { AccountSummary } from "@/lib/supabase/types"

const fieldClassName =
  "mt-1.5 min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5"

export function AccountValuationDialog({
  account,
  onClose,
  onSaved,
  onRefreshFailed,
}: {
  account: AccountSummary | null
  onClose: () => void
  onSaved: () => Promise<void>
  onRefreshFailed?: () => void
}) {
  const { t } = useTranslation()
  const attempt = useRef<SubmissionAttempt | null>(null)
  const [amount, setAmount] = useState("")
  const [valuedOn, setValuedOn] = useState(() =>
    new Date().toISOString().slice(0, 10)
  )
  const [method, setMethod] = useState<ValuationMethodCode | "">("")
  const [customMethod, setCustomMethod] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  if (!account) return null
  const today = new Date().toISOString().slice(0, 10)
  const valuationAccountType: ValuationAccountTypeCode | null =
    account.account_type_code === "business" ||
    account.account_type_code === "real_estate"
      ? account.account_type_code
      : null
  const valuationMethodOptions = valuationAccountType
    ? valuationMethodOptionsByAccountType[valuationAccountType]
    : []

  const save = async () => {
    const valuationAmount = normalizeMoneyInput(amount.trim())
    if (valuationAmount === null) {
      setError(t("accounts.validation.balanceInvalid"))
      return
    }
    if (!valuedOn) {
      setError(t("accounts.validation.valuationDateRequired"))
      return
    }
    if (valuedOn > today) {
      setError(t("accounts.validation.valuationDateFuture"))
      return
    }
    if (valuationAccountType && method === "other" && !customMethod.trim()) {
      setError(t("accounts.validation.valuationMethodOtherRequired"))
      return
    }

    setError(null)
    setIsSaving(true)
    try {
      const input = {
        valuationAmount,
        valuedOn,
        valuationMethod: valuationAccountType
          ? toStoredValuationMethod(
              valuationAccountType,
              method,
              customMethod
            )
          : null,
        notes: notes.trim() || null,
      }
      attempt.current = resolveSubmissionAttempt(attempt.current, createFingerprint({ accountId: account.id, ...input }))
      const outcome = await runMutationThenRefresh({
        mutate: () => addAccountValuation(account.id, input, attempt.current!.idempotencyKey).then(() => undefined),
        onCommitted: () => { attempt.current = null; onClose() },
        refresh: onSaved,
      })
      if (outcome.mutation === "rejected") throw outcome.error
      if (outcome.refresh === "stale") onRefreshFailed?.()
    } catch {
      setError(t("accounts.error.unexpected"))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !isSaving) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop
          className="bg-black/60"
          style={{ position: "fixed", inset: 0, zIndex: 70 }}
        />
        <Dialog.Popup
          className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl sm:p-7"
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "min(32rem, calc(100vw - 2rem))",
            zIndex: 80,
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-heading text-xl font-semibold">
                {t("accounts.valuation.title")}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                {account.name}
              </Dialog.Description>
            </div>
            <Dialog.Close
              disabled={isSaving}
              render={<Button variant="ghost" size="icon" />}
            >
              <X size={18} />
            </Dialog.Close>
          </div>
          <div className="mt-5 space-y-4">
            <label className="block text-sm font-semibold">
              {t("accounts.form.currentValue")}
              <MoneyInput
                value={amount}
                onValueChange={(value) => {
                  setAmount(value)
                  setError(null)
                }}
                dir="ltr"
                className={fieldClassName}
              />
            </label>
            <label className="block text-sm font-semibold">
              {t("accounts.form.valuationDate")}
              <input
                value={valuedOn}
                onChange={(event) => setValuedOn(event.target.value)}
                type="date"
                max={today}
                className={fieldClassName}
              />
            </label>
            {valuationAccountType ? (
              <div>
                <label
                  htmlFor="account-valuation-method"
                  className="block text-sm font-semibold"
                >
                  {t("accounts.form.valuationMethod")}
                </label>
                <select
                  id="account-valuation-method"
                  value={method}
                  onChange={(event) => {
                    setMethod(
                      event.target.value as ValuationMethodCode | ""
                    )
                    if (event.target.value !== "other") setCustomMethod("")
                  }}
                  className={fieldClassName}
                >
                  <option value="">
                    {t("accounts.form.selectPlaceholder")}
                  </option>
                  {valuationMethodOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </option>
                  ))}
                </select>
                {method === "other" ? (
                  <label className="mt-3 block text-sm font-semibold">
                    {t("accounts.form.valuationMethodOther")}
                    <input
                      value={customMethod}
                      onChange={(event) => setCustomMethod(event.target.value)}
                      className={fieldClassName}
                    />
                  </label>
                ) : null}
              </div>
            ) : null}
            <label className="block text-sm font-semibold">
              {t("accounts.form.valuationNotes")}
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className={`${fieldClassName} min-h-20`}
              />
            </label>
            {error ? (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            ) : null}
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void save()} disabled={isSaving}>
              {isSaving
                ? t("accounts.form.saving")
                : t("accounts.valuation.updateValue")}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
