import { useTranslation } from "../../../i18n/useTranslation"
import type { AssetSummary } from "../../../lib/supabase/types"

type Props = {
  asset: AssetSummary | null
  isSaving: boolean
  mode: "archive" | "delete"
  onCancel: () => void
  onConfirm: () => Promise<void>
}

export function AssetConfirmDialog({
  asset,
  isSaving,
  mode,
  onCancel,
  onConfirm,
}: Props) {
  const { t } = useTranslation()
  if (!asset) return null
  const destructive = mode === "delete"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${mode}-asset-title`}
        className="w-full max-w-md rounded-3xl border border-[var(--color-border)] bg-[var(--color-background)] p-6 shadow-2xl"
      >
        <h2 id={`${mode}-asset-title`} className="text-xl font-bold">
          {t(
            destructive ? "assets.delete.title" : "assets.archive.title",
            { name: asset.name },
          )}
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
          {t(
            destructive
              ? "assets.delete.description"
              : "assets.archive.description",
          )}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            disabled={isSaving}
            onClick={onCancel}
            className="tharwati-button-secondary"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void onConfirm()}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${
              destructive ? "bg-red-700" : "bg-amber-600"
            }`}
          >
            {t(
              isSaving
                ? destructive
                  ? "assets.delete.deleting"
                  : "assets.archive.archiving"
                : destructive
                  ? "assets.delete.confirm"
                  : "assets.archive.confirm",
            )}
          </button>
        </div>
      </section>
    </div>
  )
}
