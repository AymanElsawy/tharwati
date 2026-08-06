import { Pencil, Plus, RefreshCw } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { useManualMarketPrices } from "@/features/market-prices/hooks/useManualMarketPrices"
import type {
  ManualMarketPrice,
  ManualMarketPriceInput,
} from "@/features/market-prices/types/manual-market-price"
import { useTranslation } from "@/i18n/useTranslation"
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges"
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog"

const positiveDecimal = /^(?:0*[1-9]\d*|0*\d*\.\d*[1-9]\d*)$/

export function MarketPricesPage() {
  const { t } = useTranslation()
  const {
    assets,
    prices,
    error,
    isLoading,
    isSaving,
    refresh,
    save,
  } = useManualMarketPrices()
  const [editing, setEditing] = useState<ManualMarketPrice | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [assetId, setAssetId] = useState("")
  const [price, setPrice] = useState("")
  const [currencyCode, setCurrencyCode] = useState("")
  const [asOf, setAsOf] = useState("")
  const [validationError, setValidationError] = useState<string | null>(
    null,
  )
  const assetById = useMemo(
    () => new Map(assets.map((asset) => [asset.id, asset])),
    [assets],
  )
  const initialForm = useMemo(() => ({ assetId: editing?.asset_id ?? "", price: editing ? String(editing.price) : "", currencyCode: editing?.currency_code ?? "", asOf: editing ? toDateTimeLocal(new Date(editing.as_of)) : "" }), [editing])
  const formDirty = isFormOpen && (assetId.trim() !== initialForm.assetId || price.trim() !== initialForm.price || currencyCode.trim().toUpperCase() !== initialForm.currencyCode || (editing !== null && asOf !== initialForm.asOf) || (editing === null && Boolean(assetId || price || currencyCode)))
  const unsaved = useUnsavedChanges(formDirty)
  const closeForm = () => unsaved.request(() => setIsFormOpen(false))

  function openForm(value: ManualMarketPrice | null) {
    setEditing(value)
    setAssetId(value?.asset_id ?? "")
    setPrice(value ? String(value.price) : "")
    setCurrencyCode(value?.currency_code ?? "")
    setAsOf(
      value
        ? toDateTimeLocal(new Date(value.as_of))
        : toDateTimeLocal(new Date()),
    )
    setValidationError(null)
    setIsFormOpen(true)
  }

  async function submit() {
    const parsedAsOf = Date.parse(asOf)
    if (
      !assetId ||
      !currencyCode ||
      !positiveDecimal.test(price) ||
      Number.isNaN(parsedAsOf)
    ) {
      setValidationError(t("marketPrices.validation.invalid"))
      return
    }
    if (parsedAsOf > Date.now()) {
      setValidationError(t("marketPrices.validation.futureDate"))
      return
    }
    const input: ManualMarketPriceInput = {
      assetId,
      price,
      currencyCode,
      asOf: new Date(asOf).toISOString(),
    }
    try {
      await save(editing?.id ?? null, input)
      setIsFormOpen(false)
    } catch {
      // The hook exposes the typed repository error in the page error state.
    }
  }

  return (
    <section className="mx-auto max-w-7xl">
      <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--color-primary)]">
            Valuation inputs
          </p>
          <h1 className="mt-2 text-3xl font-black">Market Prices</h1>
          <p className="mt-2 text-[var(--color-text-secondary)]">
            Maintain your current manual prices for portfolio valuation.
          </p>
        </div>
        <Button onClick={() => openForm(null)}>
          <Plus /> Add Market Price
        </Button>
      </header>

      {error ? (
        <div role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-red-700">
          {error.message}
        </div>
      ) : null}
      {isLoading ? (
        <div className="h-52 animate-pulse rounded-3xl bg-[var(--color-surface)]" />
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-start text-sm">
                <th className="p-4">Asset</th>
                <th className="p-4">Price</th>
                <th className="p-4">Effective date</th>
                <th className="p-4">Source</th>
                <th className="p-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {prices.map((item) => (
                <tr key={item.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="p-4 font-semibold">
                    {assetById.get(item.asset_id)?.name ?? item.asset_id}
                  </td>
                  <td className="p-4 font-mono" dir="ltr">
                    {item.currency_code} {String(item.price)}
                  </td>
                  <td className="p-4">
                    {new Date(item.as_of).toLocaleString()}
                  </td>
                  <td className="p-4">{item.provider}</td>
                  <td className="p-4">
                    <Button variant="outline" onClick={() => openForm(item)}>
                      <Pencil /> Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {prices.length === 0 ? (
            <p className="p-10 text-center text-[var(--color-text-secondary)]">
              No manual market prices yet.
            </p>
          ) : null}
        </div>
      )}
      {error ? (
        <Button className="mt-4" variant="outline" onClick={() => void refresh()}>
          <RefreshCw /> Try Again
        </Button>
      ) : null}

      {isFormOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <section role="dialog" aria-modal="true" className="w-full max-w-lg rounded-3xl bg-[var(--color-surface)] p-6">
            <h2 className="text-xl font-bold">
              {editing ? "Edit Market Price" : "Add Market Price"}
            </h2>
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-semibold">
                Asset
                <select
                  className="mt-1.5 w-full rounded-xl border p-3"
                  value={assetId}
                  onChange={(event) => {
                    const id = event.target.value
                    setAssetId(id)
                    setCurrencyCode(
                      assetById.get(id)?.currency_code ?? "",
                    )
                  }}
                >
                  <option value="">Select asset</option>
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name} {asset.symbol ? `(${asset.symbol})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Price
                <input
                  className="mt-1.5 w-full rounded-xl border p-3"
                  inputMode="decimal"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                />
              </label>
              <label className="block text-sm font-semibold">
                Currency
                <input
                  className="mt-1.5 w-full rounded-xl border p-3"
                  maxLength={3}
                  value={currencyCode}
                  onChange={(event) =>
                    setCurrencyCode(event.target.value.toUpperCase())
                  }
                />
              </label>
              <label className="block text-sm font-semibold">
                Effective date
                <input
                  type="datetime-local"
                  max={toDateTimeLocal(new Date())}
                  className="mt-1.5 w-full rounded-xl border p-3"
                  value={asOf}
                  onChange={(event) => setAsOf(event.target.value)}
                />
              </label>
              {validationError ? (
                <p role="alert" className="text-sm text-red-600">
                  {validationError}
                </p>
              ) : null}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={closeForm}>
                Cancel
              </Button>
              <Button disabled={isSaving} onClick={() => void submit()}>
                {isSaving ? "Saving…" : "Save Price"}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
      <UnsavedChangesDialog open={unsaved.confirmationOpen} onKeepEditing={unsaved.keepEditing} onDiscard={unsaved.discard} />
    </section>
  )
}

function toDateTimeLocal(date: Date): string {
  const localTime = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  )
  return localTime.toISOString().slice(0, 16)
}
