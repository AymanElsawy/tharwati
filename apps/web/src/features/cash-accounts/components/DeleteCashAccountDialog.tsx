import type { AccountSummary } from "@/lib/supabase/types"
import { Button } from "@/components/ui/button"

interface DeleteCashAccountDialogProps {
  account: AccountSummary | null
  isSaving: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteCashAccountDialog({
  account,
  isSaving,
  onCancel,
  onConfirm,
}: DeleteCashAccountDialogProps) {
  if (!account) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-cash-account-title"
        className="w-full max-w-md rounded-3xl border border-[var(--color-border)] bg-[var(--color-background)] p-6 shadow-2xl"
      >
        <h2 id="delete-cash-account-title" className="text-xl font-bold text-[var(--color-text)]">
          Delete {account.name}?
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
          This permanently removes the account. Accounts referenced by financial history cannot
          be deleted.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" disabled={isSaving} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={isSaving} onClick={onConfirm}>
            {isSaving ? "Deleting..." : "Delete Account"}
          </Button>
        </div>
      </section>
    </div>
  )
}
