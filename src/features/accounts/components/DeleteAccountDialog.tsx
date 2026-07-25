import type { AccountSummary } from "../../../lib/supabase/types"
import { useTranslation } from "../../../i18n/useTranslation"

type DeleteAccountDialogProps = {
  account: AccountSummary | null
  isSaving: boolean
  onCancel: () => void
  onConfirm: () => Promise<void>
}

export function DeleteAccountDialog({
  account,
  isSaving,
  onCancel,
  onConfirm,
}: DeleteAccountDialogProps) {
  const { t } = useTranslation()
  if (!account) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        aria-describedby="delete-account-description"
        className="w-full max-w-md rounded-3xl border border-[var(--color-border)] bg-[var(--color-background)] p-6 shadow-2xl"
      >
        <h2
          id="delete-account-title"
          className="text-xl font-bold text-[var(--color-text-primary)]"
        >
          {t("accounts.delete.title", { name: account.name })}
        </h2>
        <p
          id="delete-account-description"
          className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]"
        >
          {t("accounts.delete.description")}
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
            className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving
              ? t("accounts.delete.deleting")
              : t("accounts.delete.confirm")}
          </button>
        </div>
      </section>
    </div>
  )
}
