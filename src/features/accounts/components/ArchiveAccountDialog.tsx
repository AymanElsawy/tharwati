import type { AccountSummary } from "../../../lib/supabase/types"
import { useTranslation } from "../../../i18n/useTranslation"

type ArchiveAccountDialogProps = {
  account: AccountSummary | null
  isSaving: boolean
  onCancel: () => void
  onConfirm: () => Promise<void>
}

export function ArchiveAccountDialog({
  account,
  isSaving,
  onCancel,
  onConfirm,
}: ArchiveAccountDialogProps) {
  const { t } = useTranslation()
  if (!account) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="archive-account-title"
        aria-describedby="archive-account-description"
        className="w-full max-w-md rounded-3xl border border-[var(--color-border)] bg-[var(--color-background)] p-6 shadow-2xl"
      >
        <h2
          id="archive-account-title"
          className="text-xl font-bold text-[var(--color-text-primary)]"
        >
          {t("accounts.archive.title", { name: account.name })}
        </h2>
        <p
          id="archive-account-description"
          className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]"
        >
          {t("accounts.archive.description")}
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
            className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving
              ? t("accounts.archive.archiving")
              : t("accounts.archive.confirm")}
          </button>
        </div>
      </section>
    </div>
  )
}
