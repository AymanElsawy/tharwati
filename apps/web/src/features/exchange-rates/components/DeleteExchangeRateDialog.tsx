import { Button } from "@/components/ui/button"
import type { StoredExchangeRate } from "@/services/exchange-rates/repository"

export function DeleteExchangeRateDialog({
  rate,
  isSaving,
  onCancel,
  onConfirm,
}: {
  rate: StoredExchangeRate | null
  isSaving: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!rate) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
      <section role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-3xl bg-[var(--color-background)] p-6 shadow-2xl">
        <h2 className="text-xl font-bold">Delete {rate.base_currency_code}/{rate.quote_currency_code}?</h2>
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">This rate will no longer be available for current currency conversion.</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" disabled={isSaving} onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" disabled={isSaving} onClick={onConfirm}>{isSaving ? "Deleting..." : "Delete Rate"}</Button>
        </div>
      </section>
    </div>
  )
}
