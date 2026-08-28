import { Dialog } from "@base-ui/react/dialog"
import { X } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { addAccountDisposal } from "@/features/accounts/services/account-disposals.service"
import { useTranslation } from "@/i18n/useTranslation"
import type { AccountSummary, Decimal } from "@/lib/supabase/types"

const currencies = ["USD", "SAR", "EGP", "EUR", "GBP"] as const

export function AccountDisposalDialog({ account, currentOwnership, onClose, onSaved }: {
  account: AccountSummary | null; currentOwnership: Decimal | null; onClose: () => void; onSaved: () => Promise<void>
}) {
  const { t } = useTranslation()
  const [amount, setAmount] = useState("")
  const [soldOn, setSoldOn] = useState(() => new Date().toISOString().slice(0, 10))
  const [currency, setCurrency] = useState(account?.currency_code ?? "SAR")
  const [ownershipSold, setOwnershipSold] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  if (!account) return null
  const isProperty = account.account_type_code === "real_estate"
  const save = async () => {
    setError(null); setIsSaving(true)
    try {
      await addAccountDisposal(account.id, {
        disposedOn: soldOn, saleAmount: amount.trim(), saleCurrencyCode: currency,
        ownershipPercentageSold: isProperty ? currentOwnership ?? "" : ownershipSold.trim(), notes: notes.trim() || null,
      })
      await onSaved(); onClose()
    } catch { setError(t("accounts.error.unexpected")) } finally { setIsSaving(false) }
  }
  return <Dialog.Root open onOpenChange={(open) => { if (!open && !isSaving) onClose() }}><Dialog.Portal><Dialog.Backdrop className="bg-black/60" style={{ position: "fixed", inset: 0, zIndex: 70 }} /><Dialog.Popup className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl sm:p-7" style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "min(32rem, calc(100vw - 2rem))", zIndex: 80 }}>
    <div className="flex items-start justify-between gap-3"><div><Dialog.Title className="font-heading text-xl font-semibold">{t(isProperty ? "accounts.disposal.markSold" : "accounts.disposal.sellOwnership")}</Dialog.Title><Dialog.Description className="mt-1 text-sm text-muted-foreground">{account.name}</Dialog.Description></div><Dialog.Close disabled={isSaving} render={<Button variant="ghost" size="icon" />}><X size={18} /></Dialog.Close></div>
    <div className="mt-5 space-y-4"><label className="block text-sm font-semibold">{t("accounts.disposal.saleAmount")}<input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" dir="ltr" className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5" /></label><label className="block text-sm font-semibold">{t("accounts.disposal.saleCurrency")}<select value={currency} onChange={(event) => setCurrency(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5">{currencies.map((item) => <option key={item}>{item}</option>)}</select></label>{isProperty ? <p className="text-sm text-muted-foreground">{t("accounts.disposal.fullSaleOnly", { percentage: currentOwnership ?? "—" })}</p> : <label className="block text-sm font-semibold">{t("accounts.disposal.ownershipSold")}<input value={ownershipSold} onChange={(event) => setOwnershipSold(event.target.value)} inputMode="decimal" dir="ltr" className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5" /></label>}<label className="block text-sm font-semibold">{t("accounts.disposal.saleDate")}<input value={soldOn} onChange={(event) => setSoldOn(event.target.value)} type="date" max={new Date().toISOString().slice(0, 10)} className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5" /></label><label className="block text-sm font-semibold">{t("accounts.disposal.notes")}<textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1.5 min-h-20 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5" /></label>{error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}</div>
    <div className="mt-6 flex justify-end gap-3"><Button variant="outline" onClick={onClose} disabled={isSaving}>{t("common.cancel")}</Button><Button onClick={() => void save()} disabled={isSaving || currentOwnership === null}>{isSaving ? t("accounts.form.saving") : t(isProperty ? "accounts.disposal.markSold" : "accounts.disposal.sellOwnership")}</Button></div>
  </Dialog.Popup></Dialog.Portal></Dialog.Root>
}
