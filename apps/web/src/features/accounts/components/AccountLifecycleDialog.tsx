import type { AccountSummary } from "../../../lib/supabase/types"
import { useTranslation } from "../../../i18n/useTranslation"

type AccountLifecycleDialogProps = {
  account: AccountSummary | null
  mode: "close" | "reopen"
  blockReason?: string | null
  isSaving: boolean
  onCancel: () => void
  onConfirm: () => Promise<void>
}

export function AccountLifecycleDialog({
  account,
  mode,
  blockReason,
  isSaving,
  onCancel,
  onConfirm,
}: AccountLifecycleDialogProps) {
  const { t } = useTranslation()
  if (!account) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-2 backdrop-blur-sm sm:p-4">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="account-lifecycle-title"
        aria-describedby="account-lifecycle-description"
        className="flex max-h-[calc(100dvh-1rem)] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-background)] shadow-2xl sm:max-h-[calc(100dvh-2rem)]"
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
          <h2
            id="account-lifecycle-title"
            className="text-xl font-bold break-words text-[var(--color-text-primary)]"
          >
            {mode === "close"
              ? t("accounts.close.title", { name: account.name })
              : t("accounts.reopen.title", { name: account.name })}
          </h2>
          <p
            id="account-lifecycle-description"
            className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]"
          >
            {mode === "close"
              ? t("accounts.close.description")
              : t("accounts.reopen.description")}
          </p>
          {mode === "close" && blockReason ? (
            <p
              role="alert"
              className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
            >
              {t(
                `accounts.close.blocked.${blockReason}` as Parameters<
                  typeof t
                >[0]
              )}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-[var(--color-border)] px-5 py-4 sm:flex-row sm:justify-end sm:gap-3 sm:px-6">
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
            disabled={isSaving || (mode === "close" && !!blockReason)}
            onClick={() => void onConfirm()}
            className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving
              ? t(
                  mode === "close"
                    ? "accounts.close.closing"
                    : "accounts.reopen.reopening"
                )
              : t(
                  mode === "close"
                    ? "accounts.close.confirm"
                    : "accounts.reopen.confirm"
                )}
          </button>
        </div>
      </section>
    </div>
  )
}
