import { Dialog } from "@base-ui/react/dialog"
import { X } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { brokerageSellsRepository } from "@/features/investments/repositories/brokerage-sells.repository"
import { getBrokerageSellPreview } from "@/features/investments/services/brokerage-sell.service"
import { useTranslation } from "@/i18n/useTranslation"
import { compareDecimals } from "@/lib/financial-calculations/decimal"
import { formatLocalDateTimeInput, localDateTimeInputToIso } from "@/lib/formatting/local-date-time"
import type { AccountSummary } from "@/lib/supabase/types"

const fieldClass = "mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"

function amount(value: string | null, currency: string, locale: string) {
  if (value === null) return "--"
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value))
}

function isPositiveDecimal(value: string) {
  return /^\d+(?:\.\d+)?$/.test(value.trim()) && compareDecimals(value, "0") === 1
}

function isNonNegativeDecimal(value: string) {
  return /^\d+(?:\.\d+)?$/.test(value.trim()) && (compareDecimals(value, "0") ?? -1) >= 0
}

export function BrokerageSellDialog({
  account,
  asset,
  holdingQuantity,
  onClose,
  onSaved,
}: {
  account: AccountSummary | null
  asset: { id: string; currency_code: string } | null
  holdingQuantity: string
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const { language, t } = useTranslation()
  const locale = language === "ar" ? "ar-SA" : "en-US"
  const [quantity, setQuantity] = useState("")
  const [unitSalePrice, setUnitSalePrice] = useState("")
  const [fees, setFees] = useState("0")
  const [occurredAt, setOccurredAt] = useState(formatLocalDateTimeInput())
  const [notes, setNotes] = useState("")
  const [rate, setRate] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isCrossCurrency = !!asset && asset.currency_code !== account?.currency_code
  const preview = useMemo(() => getBrokerageSellPreview({
    quantity,
    unitSalePrice,
    fees,
    accountFxRate: isCrossCurrency ? rate || null : null,
  }), [fees, isCrossCurrency, quantity, rate, unitSalePrice])
  const exceedsHolding = isPositiveDecimal(quantity) && compareDecimals(quantity, holdingQuantity) === 1
  const valid = !!account && !!asset && isPositiveDecimal(quantity) && !exceedsHolding && isPositiveDecimal(unitSalePrice) && isNonNegativeDecimal(fees) && preview.netAssetProceeds !== null && compareDecimals(preview.netAssetProceeds, "0") === 1 && !!occurredAt && (!isCrossCurrency || isPositiveDecimal(rate))

  const save = async () => {
    if (!account || !asset || !valid) return
    setSaving(true)
    setError(null)
    try {
      await brokerageSellsRepository.addBrokerageSell({
        p_account_id: account.id,
        p_asset_id: asset.id,
        p_quantity: quantity,
        p_unit_sale_price: unitSalePrice,
        p_occurred_at: localDateTimeInputToIso(occurredAt),
        p_notes: notes.trim() || null,
        p_fees: fees.trim() || "0",
        p_account_fx_rate: isCrossCurrency ? rate : null,
      })
      await onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("brokerage.sellError"))
    } finally {
      setSaving(false)
    }
  }

  return <Dialog.Root open={account !== null} onOpenChange={(open) => !open && !saving && onClose()}>
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-[90] bg-black/40" />
      <Dialog.Popup className="fixed inset-x-3 top-1/2 z-[100] mx-auto max-h-[calc(100vh-1.5rem)] w-auto max-w-lg -translate-y-1/2 overflow-y-auto rounded-xl bg-background p-5 shadow-xl sm:inset-x-0">
        <div className="flex items-center justify-between gap-3">
          <Dialog.Title className="font-heading text-xl">{t("brokerage.sell")}</Dialog.Title>
          <Button variant="ghost" size="icon" aria-label={t("common.close")} onClick={onClose}><X size={18} /></Button>
        </div>
        <div className="mt-5 space-y-4">
          <p className="text-sm text-muted-foreground">{t("brokerage.currentQuantity")}: <strong className="tabular-nums" dir="ltr">{holdingQuantity}</strong></p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>{t("investment.quantity")}<input className={fieldClass} dir="ltr" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
            <label>{t("brokerage.unitSalePrice")}{asset ? ` (${asset.currency_code})` : ""}<input className={fieldClass} dir="ltr" inputMode="decimal" value={unitSalePrice} onChange={(event) => setUnitSalePrice(event.target.value)} /></label>
          </div>
          {exceedsHolding ? <p className="text-sm text-red-600">{t("brokerage.sellQuantityExceeded")}</p> : null}
          <label>{t("investment.fees")}{asset ? ` (${asset.currency_code})` : ""}<input className={fieldClass} dir="ltr" inputMode="decimal" value={fees} onChange={(event) => setFees(event.target.value)} /></label>
          {isCrossCurrency ? <label>{t("brokerage.historicalFxRate")}<span className="mt-1 block text-xs text-muted-foreground">{t("brokerage.historicalFxRateHelp", { assetCurrency: asset?.currency_code ?? "", accountCurrency: account?.currency_code ?? "" })}</span><input className={fieldClass} dir="ltr" inputMode="decimal" value={rate} onChange={(event) => setRate(event.target.value)} /></label> : null}
          <div className="grid gap-2 rounded-lg bg-muted/50 p-3 text-sm sm:grid-cols-2">
            <Preview label={t("brokerage.grossProceeds")} value={amount(preview.grossProceeds, asset?.currency_code ?? account?.currency_code ?? "USD", locale)} />
            <Preview label={t("investment.fees")} value={amount(preview.fees, asset?.currency_code ?? account?.currency_code ?? "USD", locale)} />
            <Preview label={t("brokerage.netProceeds")} value={amount(preview.netAssetProceeds, asset?.currency_code ?? account?.currency_code ?? "USD", locale)} />
            <Preview label={t("brokerage.cashProceeds")} value={amount(preview.estimatedNetCashProceeds, account?.currency_code ?? "USD", locale)} />
          </div>
          <label>{t("investment.date")}<input className={fieldClass} type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} /></label>
          <label>{t("investment.notes")}<textarea className={fieldClass} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button className="w-full" disabled={saving || !valid} onClick={() => void save()}>{saving ? t("brokerage.selling") : t("brokerage.sell")}</Button>
        </div>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
}

function Preview({ label, value }: { label: string; value: string }) {
  return <span className="min-w-0"><span className="block text-xs text-muted-foreground">{label}</span><strong className="block break-words tabular-nums" dir="ltr">{value}</strong></span>
}
