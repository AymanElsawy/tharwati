import { Dialog } from "@base-ui/react/dialog"
import { X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { assetsRepository } from "@/features/assets/repositories/assets.repository"
import { brokerageBuysRepository } from "@/features/investments/repositories/brokerage-buys.repository"
import { getBrokerageBuyPreview } from "@/features/investments/services/brokerage-buy.service"
import { useTranslation } from "@/i18n/useTranslation"
import { formatLocalDateTimeInput, localDateTimeInputToIso } from "@/lib/formatting/local-date-time"
import type { AccountSummary, AssetSummary } from "@/lib/supabase/types"

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

  useEffect(() => {
    if (!account) return
    void assetsRepository.searchAssets("", 100).then(setAssets).catch(() => setAssets([]))
  }, [account])

  const asset = useMemo(() => assets.find((item) => item.id === assetId) ?? null, [assets, assetId])
  const isCrossCurrency = !!asset && asset.currency_code !== account?.currency_code
  const preview = getBrokerageBuyPreview({ quantity, unitPrice, fees, accountFxRate: isCrossCurrency ? rate || null : null })
  const valid = !!account && !!asset && isPositiveDecimal(quantity) && isPositiveDecimal(unitPrice) && isNonNegativeDecimal(fees) && !!occurredAt && (!isCrossCurrency || isPositiveDecimal(rate))

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
      <Dialog.Popup className="fixed inset-x-3 top-1/2 z-50 mx-auto max-h-[calc(100vh-1.5rem)] w-auto max-w-lg -translate-y-1/2 overflow-y-auto rounded-xl bg-background p-5 shadow-xl sm:inset-x-0">
        <div className="flex items-center justify-between gap-3"><Dialog.Title className="font-heading text-xl">{t("brokerage.buy")}</Dialog.Title><Button variant="ghost" size="icon" aria-label={t("common.close")} onClick={onClose}><X size={18} /></Button></div>
        <div className="mt-5 space-y-4">
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
