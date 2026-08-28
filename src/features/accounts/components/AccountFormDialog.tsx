import { Dialog } from "@base-ui/react/dialog"
import { AlertTriangle, X } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { useTranslation } from "@/i18n/useTranslation"
import { accountTypeVisuals } from "../types/account-visuals"
import {
  accountTypeOptions,
  getAccountTypeLabel,
  type AccountFormValues,
  type AccountTypeCode,
} from "../types/account-form"
import { AccountForm } from "./AccountForm"

type AccountFormDialogProps = {
  defaultValues: AccountFormValues
  isOpen: boolean
  isSaving: boolean
  isCurrencyLocked?: boolean
  isOpeningBalanceLocked?: boolean
  mode: "create" | "edit"
  onClose: () => void
  onSubmit: (values: AccountFormValues) => Promise<void>
  onDirtyChange: (dirty: boolean) => void
}

export function AccountFormDialog({
  defaultValues,
  isOpen,
  isSaving,
  isCurrencyLocked = false,
  isOpeningBalanceLocked = false,
  mode,
  onClose,
  onSubmit,
  onDirtyChange,
}: AccountFormDialogProps) {
  const { t } = useTranslation()
  const formId = `${mode}-account-form`
  const [creationStep, setCreationStep] = useState<"type" | "form">("type")
  const [selectedType, setSelectedType] = useState<AccountTypeCode | null>(null)
  const [sessionId, setSessionId] = useState(0)
  const [wasOpen, setWasOpen] = useState(isOpen)
  const [submitError, setSubmitError] = useState<string | null>(null)

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen)
    if (isOpen) {
      setCreationStep("type")
      setSelectedType(null)
      setSessionId((id) => id + 1)
      setSubmitError(null)
    }
  }

  const effectiveDefaults = useMemo(
    () => selectedType ? { ...defaultValues, accountTypeCode: selectedType } : defaultValues,
    [defaultValues, selectedType],
  )
  const choosingType = mode === "create" && creationStep === "type"
  const activeAccent = accountTypeVisuals[effectiveDefaults.accountTypeCode]

  return (
    <Dialog.Root
      open={isOpen}
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
          className="flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] outline-none shadow-2xl"
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex",
            width: "min(48rem, calc(100vw - 2rem))",
            maxHeight: "calc(100dvh - 2rem)",
            zIndex: 80,
          }}
        >
          <header
            className={`flex shrink-0 items-start justify-between gap-5 border-b border-[var(--color-border)] bg-gradient-to-br from-[var(--color-primary-soft)] via-[var(--color-primary-soft)]/30 to-transparent px-5 py-4 sm:px-7 sm:py-5`}
          >
            <div className="min-w-0">
              {!choosingType ? (
                <span
                  className={`mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${activeAccent.iconWrap}`}
                >
                  <activeAccent.icon size={13} />
                  {getAccountTypeLabel(effectiveDefaults.accountTypeCode, t)}
                </span>
              ) : null}
              <Dialog.Title className="font-heading text-xl font-semibold">
                {t(
                  mode === "create"
                    ? choosingType ? "accounts.form.chooseTypeTitle" : "accounts.form.createTitle"
                    : "accounts.form.editTitle",
                )}
              </Dialog.Title>
              <Dialog.Description className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                {t(choosingType ? "accounts.form.chooseTypeDescription" : "accounts.form.description")}
              </Dialog.Description>
            </div>
            <Dialog.Close
              disabled={isSaving}
              render={<Button variant="ghost" size="icon" className="shrink-0" />}
            >
              <X size={18} />
              <span className="sr-only">{t("accounts.form.close")}</span>
            </Dialog.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7 sm:py-6">
            {choosingType ? (
              <fieldset>
                <legend className="sr-only">{t("accounts.form.chooseTypeTitle")}</legend>
                <div className="grid gap-3 sm:grid-cols-2" role="radiogroup">
                  {accountTypeOptions.map((option) => {
                    const accent = accountTypeVisuals[option.value]
                    const Icon = accent.icon
                    const selected = selectedType === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setSelectedType(option.value)}
                        className={`flex min-h-20 items-center gap-3.5 rounded-2xl border-2 px-4 py-3.5 text-start text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${selected ? accent.selected : accent.idle}`}
                      >
                        <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${accent.iconWrap}`}>
                          <Icon size={19} />
                        </span>
                        {t(option.creationLabelKey)}
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            ) : <>
              {submitError ? (
                <div
                  role="alert"
                  className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-600/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300"
                >
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>{submitError}</span>
                </div>
              ) : null}
            <AccountForm
                key={sessionId}
                defaultValues={effectiveDefaults}
                formId={formId}
                isSaving={isSaving}
                isCurrencyLocked={isCurrencyLocked}
              isOpeningBalanceLocked={isOpeningBalanceLocked}
              mode={mode}
                onSubmit={async (values) => {
                  setSubmitError(null)
                  try {
                    await onSubmit(values)
                  } catch (cause) {
                    setSubmitError(
                      cause instanceof Error
                        ? cause.message
                        : t("accounts.error.unexpected"),
                    )
                  }
                }}
                onDirtyChange={onDirtyChange}
              />
            </>}
          </div>

          <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface-muted)] px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={onClose}
            >
              {t("common.cancel")}
            </Button>
            {choosingType ? <Button key="continue" type="button" disabled={selectedType === null} onClick={() => setCreationStep("form")}>
              {t("common.continue")}
            </Button> : <Button key="submit" type="submit" form={formId} disabled={isSaving}>
              {isSaving
                ? t("accounts.form.saving")
                : mode === "create"
                  ? t("accounts.actions.create")
                  : t("accounts.form.saveChanges")}
            </Button>}
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
