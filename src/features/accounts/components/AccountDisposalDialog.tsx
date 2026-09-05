import { Dialog } from "@base-ui/react/dialog"
import { X } from "lucide-react"
import { useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  addAccountDisposal,
  getEligibleDisposalDestinationAccounts,
} from "@/features/accounts/services/account-disposals.service"
import { useAccounts } from "@/features/accounts/hooks/useAccounts"
import {
  createAccountDisposalFormState,
  isPositiveSaleAmount,
  normalizeSaleAmount,
  resolveAccountDisposalSubmissionAttempt,
  type AccountDisposalSubmissionAttempt,
} from "@/features/accounts/utils/account-disposal-form"
import { useTranslation } from "@/i18n/useTranslation"
import { getAccountPickerOptions } from "@/features/accounts/utils/account-display-label"
import type { AccountSummary, Decimal } from "@/lib/supabase/types"

const currencies = ["USD", "SAR", "EGP", "EUR", "GBP"] as const

type AccountDisposalDialogProps = {
  account: AccountSummary | null
  currentOwnership: Decimal | null
  onClose: () => void
  onSaved: () => Promise<void>
}

export function AccountDisposalDialog(props: AccountDisposalDialogProps) {
  if (!props.account) return null
  return (
    <AccountDisposalDialogContent
      key={props.account.id}
      {...props}
      account={props.account}
    />
  )
}

function AccountDisposalDialogContent({
  account,
  currentOwnership,
  onClose,
  onSaved,
}: Omit<AccountDisposalDialogProps, "account"> & { account: AccountSummary }) {
  const { t } = useTranslation()
  const { accounts, isLoading: areAccountsLoading } = useAccounts()
  const [form, setForm] = useState(() =>
    createAccountDisposalFormState(account)
  )
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const submissionAttempt = useRef<AccountDisposalSubmissionAttempt | null>(
    null
  )
  const isProperty = account.account_type_code === "real_estate"
  const positiveProceeds = isPositiveSaleAmount(form.amount)
  const destinationAccounts = getEligibleDisposalDestinationAccounts(
    accounts,
    form.currency
  )
  const fieldClass =
    "mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5"

  const save = async () => {
    const saleAmount = normalizeSaleAmount(form.amount)
    if (saleAmount === null) {
      setError(t("accounts.validation.saleAmount"))
      return
    }
    if (isPositiveSaleAmount(saleAmount) && !form.destinationAccountId) {
      setError(t("accounts.validation.saleDestinationRequired"))
      return
    }

    setError(null)
    setIsSaving(true)
    try {
      const input = {
        disposedOn: form.soldOn,
        saleAmount,
        saleCurrencyCode: form.currency,
        ownershipPercentageSold: isProperty
          ? (currentOwnership ?? "")
          : form.ownershipSold.trim(),
        destinationAccountId: positiveProceeds
          ? form.destinationAccountId
          : null,
        notes: form.notes.trim() || null,
      }
      submissionAttempt.current = resolveAccountDisposalSubmissionAttempt(
        submissionAttempt.current,
        input
      )
      await addAccountDisposal(account.id, {
        ...input,
        idempotencyKey: submissionAttempt.current.idempotencyKey,
      })
      await onSaved()
      onClose()
      window.dispatchEvent(new Event("tharwati:data-changed"))
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
                {t(
                  isProperty
                    ? "accounts.disposal.markSold"
                    : "accounts.disposal.sellOwnership"
                )}
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

          <div className="mt-5 max-h-[min(65dvh,34rem)] space-y-4 overflow-y-auto pe-1">
            <label className="block text-sm font-semibold">
              {t("accounts.disposal.saleAmount")}
              <input
                value={form.amount}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    amount: event.target.value,
                    destinationAccountId: isPositiveSaleAmount(
                      event.target.value
                    )
                      ? current.destinationAccountId
                      : "",
                  }))
                }
                inputMode="decimal"
                dir="ltr"
                className={fieldClass}
              />
            </label>
            <label className="block text-sm font-semibold">
              {t("accounts.disposal.saleCurrency")}
              <select
                value={form.currency}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    currency: event.target.value,
                    destinationAccountId: "",
                  }))
                }
                className={fieldClass}
              >
                {currencies.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            {positiveProceeds ? (
              <label className="block text-sm font-semibold">
                {t("accounts.disposal.destinationAccount")}
                <select
                  value={form.destinationAccountId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      destinationAccountId: event.target.value,
                    }))
                  }
                  required
                  disabled={areAccountsLoading}
                  className={fieldClass}
                >
                  <option value="">
                    {t(
                      areAccountsLoading
                        ? "common.loading"
                        : "accounts.disposal.destinationPlaceholder"
                    )}
                  </option>
                  {getAccountPickerOptions(destinationAccounts, t).map(
                    (option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    )
                  )}
                </select>
                {!areAccountsLoading && destinationAccounts.length === 0 ? (
                  <span className="mt-1.5 block text-xs font-normal text-muted-foreground">
                    {t("accounts.disposal.noDestinationAccounts")}
                  </span>
                ) : null}
              </label>
            ) : null}
            {isProperty ? (
              <p className="text-sm text-muted-foreground">
                {t("accounts.disposal.fullSaleOnly", {
                  percentage: currentOwnership ?? "—",
                })}
              </p>
            ) : (
              <label className="block text-sm font-semibold">
                {t("accounts.disposal.ownershipSold")}
                <input
                  value={form.ownershipSold}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      ownershipSold: event.target.value,
                    }))
                  }
                  inputMode="decimal"
                  dir="ltr"
                  className={fieldClass}
                />
              </label>
            )}
            <label className="block text-sm font-semibold">
              {t("accounts.disposal.saleDate")}
              <input
                value={form.soldOn}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    soldOn: event.target.value,
                  }))
                }
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                className={fieldClass}
              />
            </label>
            <label className="block text-sm font-semibold">
              {t("accounts.disposal.notes")}
              <textarea
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                className={`${fieldClass} min-h-20`}
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
            <Button
              onClick={() => void save()}
              disabled={isSaving || currentOwnership === null}
            >
              {isSaving
                ? t("accounts.form.saving")
                : t(
                    isProperty
                      ? "accounts.disposal.markSold"
                      : "accounts.disposal.sellOwnership"
                  )}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
