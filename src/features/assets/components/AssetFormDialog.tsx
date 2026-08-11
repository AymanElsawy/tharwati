import { X } from "lucide-react"

import { useTranslation } from "../../../i18n/useTranslation"
import type { AssetFormValues } from "../types/asset-form"
import { AssetForm } from "./AssetForm"

type Props = {
  defaultValues: AssetFormValues
  isOpen: boolean
  isSaving: boolean
  mode: "create" | "edit"
  onClose: () => void
  onSubmit: (values: AssetFormValues) => Promise<void>
  onDirtyChange?: (dirty: boolean) => void
}

export function AssetFormDialog(props: Props) {
  const { t } = useTranslation()
  if (!props.isOpen) return null
  const formId = `${props.mode}-asset-form`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${formId}-title`}
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-[var(--color-border)] bg-[var(--color-background)] shadow-2xl"
      >
        <header className="sticky top-0 flex items-start justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-background)] px-4 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <h2 id={`${formId}-title`} className="text-xl font-bold">
              {t(
                props.mode === "create"
                  ? "assets.form.createTitle"
                  : "assets.form.editTitle",
              )}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {t("assets.form.description")}
            </p>
          </div>
          <button
            type="button"
            aria-label={t("assets.form.close")}
            disabled={props.isSaving}
            onClick={props.onClose}
            className="rounded-xl p-2"
          >
            <X size={20} />
          </button>
        </header>
        <div className="px-4 py-5 sm:px-6 sm:py-6">
          <AssetForm
            defaultValues={props.defaultValues}
            formId={formId}
            isSaving={props.isSaving}
            onSubmit={props.onSubmit}
            onDirtyChange={props.onDirtyChange}
          />
        </div>
        <footer className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3 sm:flex-row sm:justify-end sm:px-6 sm:py-4">
          <button
            type="button"
            disabled={props.isSaving}
            onClick={props.onClose}
            className="tharwati-button-secondary w-full sm:w-auto"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            form={formId}
            disabled={props.isSaving}
            className="tharwati-button-primary w-full disabled:opacity-60 sm:w-auto"
          >
            {props.isSaving
              ? t("assets.form.saving")
              : props.mode === "create"
                ? t("assets.actions.create")
                : t("assets.form.saveChanges")}
          </button>
        </footer>
      </section>
    </div>
  )
}
