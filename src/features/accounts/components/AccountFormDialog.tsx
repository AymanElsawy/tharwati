import { X } from "lucide-react"
import { useTranslation } from "../../../i18n/useTranslation"

import type { AccountFormValues } from "../types/account-form"
import { AccountForm } from "./AccountForm"

type AccountFormDialogProps = {
  defaultValues: AccountFormValues
  isOpen: boolean
  isSaving: boolean
  mode: "create" | "edit"
  onClose: () => void
  onSubmit: (values: AccountFormValues) => Promise<void>
}

export function AccountFormDialog({
  defaultValues,
  isOpen,
  isSaving,
  mode,
  onClose,
  onSubmit,
}: AccountFormDialogProps) {
  const { t } = useTranslation()
  if (!isOpen) {
    return null
  }

  const formId = `${mode}-account-form`
  const title =
    mode === "create"
      ? t("accounts.form.createTitle")
      : t("accounts.form.editTitle")

  async function handleSubmit(values: AccountFormValues) {
    await onSubmit(values)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !isSaving) {
          onClose()
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${formId}-title`}
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-[var(--color-border)] bg-[var(--color-background)] shadow-2xl"
      >
        <header className="sticky top-0 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-background)] px-6 py-5">
          <div>
            <h2
              id={`${formId}-title`}
              className="text-xl font-bold text-[var(--color-text-primary)]"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {t("accounts.form.description")}
            </p>
          </div>
          <button
            type="button"
            aria-label={t("accounts.form.close")}
            disabled={isSaving}
            onClick={onClose}
            className="rounded-xl p-2 text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </header>

        <div className="px-6 py-6">
          <AccountForm
            defaultValues={defaultValues}
            formId={formId}
            isSaving={isSaving}
            onSubmit={handleSubmit}
          />
        </div>

        <footer className="sticky bottom-0 flex justify-end gap-3 border-t border-[var(--color-border)] bg-[var(--color-background)] px-6 py-4">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="tharwati-button-secondary"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            form={formId}
            disabled={isSaving}
            className="tharwati-button-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving
              ? t("accounts.form.saving")
              : mode === "create"
                ? t("accounts.actions.create")
                : t("accounts.form.saveChanges")}
          </button>
        </footer>
      </section>
    </div>
  )
}
