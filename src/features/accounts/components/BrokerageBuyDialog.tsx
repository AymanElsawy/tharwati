import { Dialog } from "@base-ui/react/dialog"
import { Search, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { assetsRepository } from "@/features/assets/repositories/assets.repository"
import { brokerageBuysRepository } from "@/features/investments/repositories/brokerage-buys.repository"
import { getBrokerageBuyPreview } from "@/features/investments/services/brokerage-buy.service"
import { useTranslation } from "@/i18n/useTranslation"
import { countries } from "@/lib/countries"
import { formatLocalDateTimeInput, localDateTimeInputToIso } from "@/lib/formatting/local-date-time"
import type { AccountSummary, AssetSummary } from "@/lib/supabase/types"
import { assetSearchService, type ExternalAssetSearchResult } from "@/services/asset-search/asset-search.service"

const fieldClass = "mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"

function amount(value: string | null, currency: string, locale: string) {
  if (value === null) return "--"
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value))
}

function isPositiveDecimal(value: string) {
  return /^\d+(?:\.\d+)?$/.test(value.trim()) &&
    value.replace(/\D/g, "").replace(/^0+/, "") !== ""
}

function isNonNegativeDecimal(value: string) {
  return /^\d+(?:\.\d+)?$/.test(value.trim())
}

export function BrokerageBuyDialog({ account, availableCash, onClose, onSaved }: { account: AccountSummary | null; availableCash: string | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const { language, t } = useTranslation()
  const locale = language === "ar" ? "ar-SA" : "en-US"
  const [assets, setAssets] = useState<AssetSummary[]>([])
  const [assetId, setAssetId] = useState("")
  const [quantity, setQuantity] = useState("")
  const [unitPrice, setUnitPrice] = useState("")
  const [fees, setFees] = useState("0")
  const [occurredAt, setOccurredAt] = useState(formatLocalDateTimeInput())
  const [notes, setNotes] = useState("")
  const [rate, setRate] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [externalSearchQuery, setExternalSearchQuery] = useState("")
  const [externalSearchCountry, setExternalSearchCountry] = useState("")
  const [externalResults, setExternalResults] = useState<ExternalAssetSearchResult[]>([])
  const [isExternalSearchLoading, setIsExternalSearchLoading] = useState(false)
  const [isExternalSearchUnavailable, setIsExternalSearchUnavailable] = useState(false)
  const [selectedExternalResult, setSelectedExternalResult] = useState<ExternalAssetSearchResult | null>(null)
  const [resolvingExternalIdentity, setResolvingExternalIdentity] = useState<string | null>(null)
  const [externalResolutionError, setExternalResolutionError] = useState(false)

  useEffect(() => {
    if (!account) return
    void assetsRepository.searchAssets("", 100).then(setAssets).catch(() => setAssets([]))
  }, [account])

  useEffect(() => {
    const query = externalSearchQuery.trim()
    if (query.length < 2) {
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      setIsExternalSearchLoading(true)
      setIsExternalSearchUnavailable(false)
      void assetSearchService.search(query, externalSearchCountry)
        .then((results) => {
          if (!cancelled) setExternalResults(results)
        })
        .catch(() => {
          if (!cancelled) {
            setExternalResults([])
            setIsExternalSearchUnavailable(true)
          }
        })
        .finally(() => {
          if (!cancelled) setIsExternalSearchLoading(false)
        })
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [externalSearchQuery, externalSearchCountry])

  const asset = useMemo(() => assets.find((item) => item.id === assetId) ?? null, [assets, assetId])
  const isCrossCurrency = !!asset && asset.currency_code !== account?.currency_code
  const preview = getBrokerageBuyPreview({ quantity, unitPrice, fees, accountFxRate: isCrossCurrency ? rate || null : null })
  const valid = !!account && !!asset && isPositiveDecimal(quantity) && isPositiveDecimal(unitPrice) && isNonNegativeDecimal(fees) && !!occurredAt && (!isCrossCurrency || isPositiveDecimal(rate))

  const handleExternalResultSelected = async (result: ExternalAssetSearchResult) => {
    const identity = `${result.micCode}:${result.symbol}`
    setSelectedExternalResult(result)
    setResolvingExternalIdentity(identity)
    setExternalResolutionError(false)

    try {
      const resolvedAsset = await assetSearchService.resolve(result)
      setAssets((current) => {
        const next = current.filter((candidate) => candidate.id !== resolvedAsset.id)
        return [...next, resolvedAsset].sort((left, right) => left.name.localeCompare(right.name))
      })
      setAssetId(resolvedAsset.id)
      setExternalSearchQuery("")
      setExternalResults([])
      setIsExternalSearchLoading(false)
      setIsExternalSearchUnavailable(false)
      setSelectedExternalResult(null)
    } catch {
      setExternalResolutionError(true)
    } finally {
      setResolvingExternalIdentity(null)
    }
  }

  const save = async () => {
    if (!account || !asset || !valid) return
    setSaving(true); setError(null)
    try {
      await brokerageBuysRepository.addBrokerageBuy({
        p_account_id: account.id, p_asset_id: asset.id, p_quantity: quantity, p_unit_price: unitPrice,
        p_occurred_at: localDateTimeInputToIso(occurredAt), p_notes: notes.trim() || null,
        p_fees: fees.trim() || "0", p_account_fx_rate: isCrossCurrency ? rate : null,
      })
      await onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("brokerage.buyError"))
    } finally { setSaving(false) }
  }

  return <Dialog.Root open={account !== null} onOpenChange={(open) => { if (!open && !saving) onClose() }}>
    <Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40" />
      <Dialog.Popup className="fixed inset-x-3 top-1/2 z-50 mx-auto max-h-[90vh] w-auto max-w-4xl -translate-y-1/2 overflow-y-auto rounded-xl bg-background p-5 shadow-xl sm:inset-x-0">
        <div className="flex items-center justify-between gap-3"><Dialog.Title className="font-heading text-xl">{t("brokerage.buy")}</Dialog.Title><Button variant="ghost" size="icon" aria-label={t("common.close")} onClick={onClose}><X size={18} /></Button></div>
        <div className="mt-5 space-y-4">
          <div className="flex items-end gap-2">
            <label className="min-w-0 flex-1 basis-2/3">{t("brokerage.searchExternalAssets")}
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input className={`${fieldClass} mt-0 ps-9`} type="search" value={externalSearchQuery} onChange={(event) => { setExternalSearchQuery(event.target.value); setExternalResults([]); setIsExternalSearchLoading(false); setIsExternalSearchUnavailable(false); setSelectedExternalResult(null); setExternalResolutionError(false) }} placeholder={t("brokerage.searchExternalAssetsPlaceholder")} autoComplete="off" />
              </div>
            </label>
            <label className="w-40 shrink-0" title={t("brokerage.externalAssetCountry")}>{t("brokerage.externalAssetCountry")}
              <select className={`${fieldClass} ps-3`} value={externalSearchCountry} onChange={(event) => { setExternalSearchCountry(event.target.value); setSelectedExternalResult(null); setExternalResolutionError(false) }}>
                <option value="">🌐 {t("brokerage.searchExternalAssetsAllCountries")}</option>
                {countries.map((country) => <option key={country.code} value={country.name}>{country.flag} {country.name}</option>)}
              </select>
            </label>
          </div>
          {externalSearchQuery.trim().length > 0 && externalSearchQuery.trim().length < 2 ? <p className="text-xs text-muted-foreground">{t("brokerage.searchExternalAssetsMinimum")}</p> : null}
          {externalSearchQuery.trim().length >= 2 && isExternalSearchLoading ? <p className="text-sm text-muted-foreground">{t("brokerage.searchExternalAssetsLoading")}</p> : null}
          {externalSearchQuery.trim().length >= 2 && isExternalSearchUnavailable ? <p className="text-sm text-muted-foreground">{t("brokerage.searchExternalAssetsUnavailable")}</p> : null}
          {externalSearchQuery.trim().length >= 2 && externalResults.length > 0 ? <div className="mt-1 max-h-72 space-y-1.5 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-1.5 shadow-md">
            {externalResults.map((result) => {
              const isSelected = selectedExternalResult?.symbol === result.symbol && selectedExternalResult.micCode === result.micCode
              return <button key={`${result.micCode}:${result.symbol}`} type="button" className={`w-full rounded-lg border px-3 py-2.5 text-start transition-colors disabled:cursor-wait disabled:opacity-60 ${isSelected ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]" : "border-transparent bg-[var(--color-surface)] hover:border-[var(--color-border)] hover:bg-[var(--color-primary-soft)]"}`} disabled={resolvingExternalIdentity !== null} onClick={() => void handleExternalResultSelected(result)}>
                <div className="flex items-start justify-between gap-3"><strong className="min-w-0 break-words">{result.name}</strong><span className="shrink-0 text-xs font-medium text-muted-foreground" dir="ltr">{result.instrumentType}</span></div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground"><span dir="ltr"><span className="font-medium">{t("assets.table.symbol")}: </span>{result.symbol}</span><span><span className="font-medium">{t("assets.table.exchange")}: </span>{result.exchange}</span><span><span className="font-medium">{t("brokerage.externalAssetCountry")}: </span>{result.country}</span><span dir="ltr"><span className="font-medium">{t("assets.table.currency")}: </span>{result.currencyCode}</span></div>
              </button>
            })}
          </div> : null}
          {resolvingExternalIdentity ? <p className="text-xs text-muted-foreground">{t("brokerage.externalAssetResolving")}</p> : null}
          {!resolvingExternalIdentity && selectedExternalResult && assetId ? <p className="text-xs text-muted-foreground">{t("brokerage.externalAssetSelected")}</p> : null}
          {externalResolutionError ? <p className="text-xs text-destructive">{t("brokerage.externalAssetResolveError")}</p> : null}
          <label>{t("investment.asset.section")}<select className={fieldClass} value={assetId} onChange={(event) => setAssetId(event.target.value)}><option value="">{t("investment.common.choose")}</option>{assets.map((item) => <option key={item.id} value={item.id}>{item.name}{item.symbol ? ` (${item.symbol})` : ""}</option>)}</select></label>
          <div className="grid gap-4 sm:grid-cols-2"><label>{t("investment.quantity")}<input className={fieldClass} dir="ltr" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><label>{t("brokerage.unitPrice")}{asset ? ` (${asset.currency_code})` : ""}<input className={fieldClass} dir="ltr" inputMode="decimal" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} /></label></div>
          <label>{t("investment.fees")}{asset ? ` (${asset.currency_code})` : ""}<input className={fieldClass} dir="ltr" inputMode="decimal" value={fees} onChange={(event) => setFees(event.target.value)} /></label>
          {isCrossCurrency ? <label>{t("brokerage.historicalFxRate")}<span className="mt-1 block text-xs text-muted-foreground">{t("brokerage.historicalFxRateHelp", { assetCurrency: asset?.currency_code ?? "", accountCurrency: account?.currency_code ?? "" })}</span><input className={fieldClass} dir="ltr" inputMode="decimal" value={rate} onChange={(event) => setRate(event.target.value)} /></label> : null}
          <div className="grid gap-2 rounded-lg bg-muted/50 p-3 text-sm sm:grid-cols-2"><Preview label={t("brokerage.purchaseAmount")} value={amount(preview.purchaseAmount, asset?.currency_code ?? account?.currency_code ?? "USD", locale)} /><Preview label={t("investment.fees")} value={amount(preview.fees, asset?.currency_code ?? account?.currency_code ?? "USD", locale)} /><Preview label={t("brokerage.cashRequired")} value={amount(preview.accountTotal, account?.currency_code ?? "USD", locale)} /><Preview label={t("brokerage.availableCash")} value={amount(availableCash, account?.currency_code ?? "USD", locale)} /></div>
          <label>{t("investment.date")}<input className={fieldClass} type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} /></label><label>{t("investment.notes")}<textarea className={fieldClass} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}<Button className="w-full" disabled={saving || !valid} onClick={() => void save()}>{saving ? t("brokerage.buying") : t("brokerage.buy")}</Button>
        </div>
      </Dialog.Popup></Dialog.Portal>
  </Dialog.Root>
}

function Preview({ label, value }: { label: string; value: string }) { return <span className="min-w-0"><span className="block text-xs text-muted-foreground">{label}</span><strong className="block break-words tabular-nums" dir="ltr">{value}</strong></span> }
