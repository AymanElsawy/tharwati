import { Dialog } from "@base-ui/react/dialog"
import { X } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { useTranslation } from "@/i18n/useTranslation"
import { accountTypeOptions, type AccountFormValues } from "../types/account-form"
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
  const [selectedType, setSelectedType] = useState<AccountFormValues["accountTypeCode"] | null>(null)

  const effectiveDefaults = useMemo(
    () => selectedType ? { ...defaultValues, accountTypeCode: selectedType } : defaultValues,
    [defaultValues, selectedType],
  )
  const choosingType = mode === "create" && creationStep === "type"

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
          className="flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--color-background)] outline-none"
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
          <header className="flex shrink-0 items-start justify-between gap-5 border-b border-[var(--border-subtle)] px-5 py-4 sm:px-7 sm:py-5">
            <div className="min-w-0">
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
                    const selected = selectedType === option.value
                    return <button key={option.value} type="button" role="radio" aria-checked={selected} onClick={() => setSelectedType(option.value)} className={`min-h-16 rounded-xl border px-4 py-3 text-start text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${selected ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]" : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:border-[var(--color-primary)]"}`}>
                      {t(option.creationLabelKey)}
                    </button>
                  })}
                </div>
              </fieldset>
            ) : <AccountForm
              defaultValues={effectiveDefaults}
              formId={formId}
              isSaving={isSaving}
              isCurrencyLocked={isCurrencyLocked}
              isOpeningBalanceLocked={isOpeningBalanceLocked}
              onSubmit={onSubmit}
              onDirtyChange={onDirtyChange}
              showAccountTypeField={mode === "edit"}
            />}
          </div>

          <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-[var(--border-subtle)] bg-background px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={onClose}
            >
              {t("common.cancel")}
            </Button>
            {choosingType ? <Button type="button" disabled={selectedType === null} onClick={() => setCreationStep("form")}>
              {t("common.continue")}
            </Button> : <Button type="submit" form={formId} disabled={isSaving}>
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
