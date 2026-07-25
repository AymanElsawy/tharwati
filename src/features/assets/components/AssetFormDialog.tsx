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
        <header className="sticky top-0 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-background)] px-6 py-5">
          <div>
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
        <div className="px-6 py-6">
          <AssetForm
            defaultValues={props.defaultValues}
            formId={formId}
            isSaving={props.isSaving}
            onSubmit={async (values) => {
              await props.onSubmit(values)
              props.onClose()
            }}
          />
        </div>
        <footer className="sticky bottom-0 flex justify-end gap-3 border-t border-[var(--color-border)] bg-[var(--color-background)] px-6 py-4">
          <button
            type="button"
            disabled={props.isSaving}
            onClick={props.onClose}
            className="tharwati-button-secondary"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            form={formId}
            disabled={props.isSaving}
            className="tharwati-button-primary disabled:opacity-60"
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
