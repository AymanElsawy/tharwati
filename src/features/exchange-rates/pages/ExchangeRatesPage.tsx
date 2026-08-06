import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { useLocation } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { DeleteExchangeRateDialog } from "@/features/exchange-rates/components/DeleteExchangeRateDialog"
import { ExchangeRateFormDialog } from "@/features/exchange-rates/components/ExchangeRateFormDialog"
import { useExchangeRates } from "@/features/exchange-rates/hooks/useExchangeRates"
import { rateToFormValues, type ExchangeRateFormValues } from "@/features/exchange-rates/types/exchange-rate-form"
import type { StoredExchangeRate } from "@/services/exchange-rates/repository"
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges"
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog"

type FormState = { mode: "create"; rate: null } | { mode: "edit"; rate: StoredExchangeRate } | null
type MissingPairState = { sourceCurrencyCode?: string; destinationCurrencyCode?: string }

export function ExchangeRatesPage() {
  const location = useLocation()
  const prefill = (location.state as MissingPairState | null) ?? {}
  const { rates, currencies, error, isLoading, isSaving, refresh, create, update, remove } = useExchangeRates()
  const [form, setForm] = useState<FormState>(null)
  const [deleteRate, setDeleteRate] = useState<StoredExchangeRate | null>(null)
  const [formDirty, setFormDirty] = useState(false)
  const unsaved = useUnsavedChanges(formDirty)
  const values = useMemo<ExchangeRateFormValues>(() => {
    if (form?.mode === "edit") return rateToFormValues(form.rate)
    return {
      fromCurrencyCode: prefill.sourceCurrencyCode ?? "",
      toCurrencyCode: prefill.destinationCurrencyCode ?? "",
      rate: "",
      effectiveAt: new Date().toISOString().slice(0, 16),
    }
  }, [form, prefill.destinationCurrencyCode, prefill.sourceCurrencyCode])

  return (
    <section className="mx-auto max-w-7xl">
      <header className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--color-primary)]">Currency management</p>
          <h1 className="mt-2 text-3xl font-black">Exchange Rates</h1>
          <p className="mt-2 text-[var(--color-text-secondary)]">Reviewed manual fallback rates. Frankfurter provider rates are automatic and take precedence.</p>
        </div>
        <Button size="lg" onClick={() => setForm({ mode: "create", rate: null })}><Plus /> Add Exchange Rate</Button>
      </header>
      {error && <div role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">{error.message}</div>}
      {isLoading ? <div className="h-64 animate-pulse rounded-3xl bg-[var(--color-surface)]" /> : rates.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
          <h2 className="text-xl font-bold">No exchange rates</h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Add a rate to enable cross-currency Net Worth calculations.</p>
          <Button className="mt-5" onClick={() => setForm({ mode: "create", rate: null })}><Plus /> Add Exchange Rate</Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full text-start">
            <thead><tr className="border-b border-[var(--color-border)] text-sm text-[var(--color-text-muted)]"><th className="p-4">Pair</th><th className="p-4">Rate</th><th className="p-4">Effective date</th><th className="p-4">Last updated</th><th className="p-4">Actions</th></tr></thead>
            <tbody>{rates.map((rate) => <tr key={rate.id} className="border-b border-[var(--color-border)] last:border-0"><td className="p-4 font-bold">{rate.base_currency_code}/{rate.quote_currency_code}</td><td className="p-4 font-mono">{rate.rate}</td><td className="p-4">{new Date(rate.effective_at).toLocaleString()}</td><td className="p-4">{new Date(rate.updated_at).toLocaleString()}</td><td className="p-4"><div className="flex gap-2"><Button variant="outline" onClick={() => setForm({ mode: "edit", rate })}><Pencil /> Edit</Button><Button variant="ghost" onClick={() => setDeleteRate(rate)}><Trash2 /> Delete</Button></div></td></tr>)}</tbody>
          </table>
        </div>
      )}
      {!isLoading && error && <Button variant="outline" className="mt-4" onClick={() => void refresh()}><RefreshCw /> Try Again</Button>}
      <ExchangeRateFormDialog currencies={currencies} values={values} mode={form?.mode ?? "create"} isOpen={form !== null} isSaving={isSaving} onDirtyChange={setFormDirty} onClose={() => { if (!isSaving) unsaved.request(() => { setForm(null); setFormDirty(false) }) }} onSubmit={async (data) => { if (form?.mode === "edit") await update(form.rate.id, data); else await create(data); setFormDirty(false); setForm(null) }} />
      <DeleteExchangeRateDialog rate={deleteRate} isSaving={isSaving} onCancel={() => setDeleteRate(null)} onConfirm={() => { if (deleteRate) void remove(deleteRate.id).then(() => setDeleteRate(null)) }} />
      <UnsavedChangesDialog open={unsaved.confirmationOpen} onKeepEditing={unsaved.keepEditing} onDiscard={unsaved.discard} />
    </section>
  )
}
