import { zodResolver } from "@hookform/resolvers/zod"
import { Dialog } from "@base-ui/react/dialog"
import { X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/i18n/useTranslation"
import { formatLocalDateTimeInput } from "@/lib/formatting/local-date-time"
import type { AccountSummary } from "@/lib/supabase/types"
import { createAccountRecordSchema } from "../schemas/account-record.schema"
import { estimateTransferReceived } from "../services/account-records.service"
import { emptyAccountRecordFormValues, type AccountRecordFormValues, type AccountRecordType } from "../types/account-record"
import { RecordCategoryPicker } from "./RecordCategoryPicker"

const field = "mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm"
const recordTypeOptions: Array<{ value: AccountRecordType; labelKey: "accounts.records.income" | "accounts.records.expense" | "accounts.records.transfer"; activeClassName: string }> = [
  { value: "income", labelKey: "accounts.records.income", activeClassName: "border-emerald-600 bg-emerald-600 text-white" },
  { value: "expense", labelKey: "accounts.records.expense", activeClassName: "border-red-600 bg-red-600 text-white" },
  { value: "transfer", labelKey: "accounts.records.transfer", activeClassName: "border-slate-600 bg-slate-600 text-white" },
]

export function AccountRecordFormDialog({ open, initialAccount, accounts, isSaving, onClose, onSubmit }: { open: boolean; initialAccount: AccountSummary | null; accounts: AccountSummary[]; isSaving: boolean; onClose: () => void; onSubmit: (values: AccountRecordFormValues) => Promise<void> }) {
  const { t } = useTranslation()
  const schema = useMemo(() => createAccountRecordSchema(t), [t])
  const { control, register, reset, setValue, handleSubmit, formState: { errors, isSubmitting } } = useForm<AccountRecordFormValues>({ resolver: zodResolver(schema), defaultValues: emptyAccountRecordFormValues })
  const values = useWatch({ control, defaultValue: emptyAccountRecordFormValues })
  const [estimateError, setEstimateError] = useState(false)
  const from = accounts.find((account) => account.id === values.accountId) ?? null
  const to = accounts.find((account) => account.id === values.toAccountId) ?? null
  const crossCurrency = values.type === "transfer" && from && to && from.currency_code !== to.currency_code
  useEffect(() => { if (open) reset({ ...emptyAccountRecordFormValues, accountId: initialAccount?.id ?? "", occurredAt: formatLocalDateTimeInput() }) }, [initialAccount, open, reset])
  useEffect(() => { if (values.type === "transfer") { setValue("mainCategoryId", ""); setValue("subcategoryId", "") } }, [setValue, values.type])
  useEffect(() => {
    let active = true
    if (!crossCurrency || !from || !to || !values.amount) { setEstimateError(false); if (values.type === "transfer" && from && to && from.currency_code === to.currency_code) setValue("receivedAmount", values.amount ?? ""); return }
    void estimateTransferReceived(values.amount, from, to).then((amount) => { if (active) { setValue("receivedAmount", amount); setEstimateError(false) } }).catch(() => { if (active) setEstimateError(true) })
    return () => { active = false }
  }, [crossCurrency, from, setValue, to, values.amount, values.type])
  const disabled = isSaving || isSubmitting
  const categoryPicker = <RecordCategoryPicker value={{ mainCategoryId: values.mainCategoryId, subcategoryId: values.subcategoryId }} onChange={(category) => { setValue("mainCategoryId", category.mainCategoryId, { shouldValidate: true }); setValue("subcategoryId", category.subcategoryId, { shouldValidate: true }) }} error={errors.subcategoryId?.message}/>

  return <Dialog.Root open={open} onOpenChange={(next) => !next && !disabled && onClose()}><Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-[90] bg-black/60" /><Dialog.Popup className="fixed top-1/2 left-1/2 z-[100] max-h-[calc(100vh-2rem)] w-[min(46rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"><header className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-5"><Dialog.Title className="font-heading text-xl font-semibold">{t("accounts.records.add")}</Dialog.Title><Dialog.Close render={<Button variant="ghost" size="icon" />}><X size={18}/></Dialog.Close></header><form id="account-record-form" className="space-y-4 px-6 py-5" onSubmit={handleSubmit(onSubmit)} noValidate><fieldset><legend className="text-sm font-semibold">{t("accounts.records.type")}</legend><div className="mt-1.5 grid grid-cols-3 gap-2">{recordTypeOptions.map((option) => { const selected = values.type === option.value; return <button key={option.value} type="button" aria-pressed={selected} onClick={() => setValue("type", option.value)} className={`min-w-0 rounded-xl border px-2 py-2.5 text-sm font-semibold transition-colors focus-visible:ring-2 ${selected ? option.activeClassName : "border-[var(--color-border)] bg-[var(--color-surface)] text-muted-foreground hover:bg-[var(--color-surface-muted)]"}`}>{t(option.labelKey)}</button> })}</div></fieldset>{values.type === "transfer" ? <><div className="grid gap-4 md:grid-cols-2"><AccountSelect label={t("accounts.records.fromAccount")} name="accountId" accounts={accounts} register={register} error={errors.accountId?.message}/><AccountSelect label={t("accounts.records.toAccount")} name="toAccountId" accounts={accounts} register={register} error={errors.toAccountId?.message}/><AmountField label={t("accounts.records.amountSent")} currency={from?.currency_code} register={register} error={errors.amount?.message}/><DateTimeField register={register} error={errors.occurredAt?.message}/></div>{crossCurrency && <AmountField label={t("accounts.records.amountReceived")} currency={to?.currency_code} register={register} error={estimateError ? t("accounts.records.fxError") : errors.receivedAmount?.message} name="receivedAmount" />}</> : <div className="grid gap-4 md:grid-cols-2"><AccountSelect label={t("accounts.records.account")} name="accountId" accounts={accounts} register={register} error={errors.accountId?.message}/>{categoryPicker}<AmountField label={t("accounts.records.amount")} currency={from?.currency_code} register={register} error={errors.amount?.message}/><DateTimeField register={register} error={errors.occurredAt?.message}/></div>}<div><label className="text-sm font-semibold">{t("accounts.records.notes")}</label><textarea className={field} rows={3} {...register("notes")}/></div></form><footer className="flex justify-end gap-2 border-t border-[var(--color-border)] px-6 py-4"><Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button><Button form="account-record-form" type="submit" disabled={disabled || estimateError}>{t("accounts.records.save")}</Button></footer></Dialog.Popup></Dialog.Portal></Dialog.Root>
}

function AccountSelect({ label, name, accounts, register, error }: { label: string; name: "accountId" | "toAccountId"; accounts: AccountSummary[]; register: ReturnType<typeof useForm<AccountRecordFormValues>>["register"]; error?: string }) { return <div><label className="text-sm font-semibold">{label}</label><select className={field} {...register(name)}><option value="">—</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} — {account.currency_code}</option>)}</select>{error && <p className="mt-1 text-sm text-red-600">{error}</p>}</div> }
function AmountField({ label, currency, register, error, name = "amount" }: { label: string; currency?: string; register: ReturnType<typeof useForm<AccountRecordFormValues>>["register"]; error?: string; name?: "amount" | "receivedAmount" }) { return <div><label className="text-sm font-semibold">{label}</label><div className="relative"><input className={field} inputMode="decimal" dir="ltr" {...register(name)}/><span className="absolute end-3 top-4 text-xs text-muted-foreground">{currency}</span></div>{error && <p className="mt-1 text-sm text-red-600">{error}</p>}</div> }
function DateTimeField({ register, error }: { register: ReturnType<typeof useForm<AccountRecordFormValues>>["register"]; error?: string }) { const { t } = useTranslation(); return <div><label className="text-sm font-semibold">{t("accounts.records.dateTime")}</label><input type="datetime-local" className={field} {...register("occurredAt")}/>{error && <p className="mt-1 text-sm text-red-600">{error}</p>}</div> }
