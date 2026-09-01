import { zodResolver } from "@hookform/resolvers/zod"
import { Dialog } from "@base-ui/react/dialog"
import { X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
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
const recordTypeOptions: Array<{
  value: AccountRecordType
  labelKey: "accounts.records.income" | "accounts.records.expense" | "accounts.records.transfer"
  activeClassName: string
}> = [
  {
    value: "income",
    labelKey: "accounts.records.income",
    activeClassName: "border-emerald-600 bg-emerald-600 text-white",
  },
  {
    value: "expense",
    labelKey: "accounts.records.expense",
    activeClassName: "border-red-600 bg-red-600 text-white",
  },
  {
    value: "transfer",
    labelKey: "accounts.records.transfer",
    activeClassName: "border-slate-600 bg-slate-600 text-white",
  },
]

export function AccountRecordFormDialog({ open, initialAccount, accounts, initialValues, isSaving, error, onClose, onSubmit, onDelete }: { open: boolean; initialAccount: AccountSummary | null; accounts: AccountSummary[]; initialValues?: AccountRecordFormValues; isSaving: boolean; error?: string | null; onClose: () => void; onSubmit: (values: AccountRecordFormValues) => Promise<void>; onDelete?: () => void }) {
  const { t } = useTranslation()
  const schema = useMemo(() => createAccountRecordSchema(t), [t])
  const {
    control,
    register,
    reset,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AccountRecordFormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyAccountRecordFormValues,
  })
  const values = useWatch({
    control,
    defaultValue: emptyAccountRecordFormValues,
  })
  const [estimateError, setEstimateError] = useState(false)
  const scrollRegionRef = useRef<HTMLFormElement>(null)
  const [visibleViewport, setVisibleViewport] = useState<{
    height: number
    top: number
  } | null>(null)
  const from = accounts.find((account) => account.id === values.accountId) ?? null
  const to = accounts.find((account) => account.id === values.toAccountId) ?? null
  const crossCurrency = values.type === "transfer" && from && to && from.currency_code !== to.currency_code
  useEffect(() => {
    if (open)
      reset(
        initialValues ?? {
          ...emptyAccountRecordFormValues,
          accountId: initialAccount?.id ?? "",
          occurredAt: formatLocalDateTimeInput(),
        }
      )
  }, [initialAccount, initialValues, open, reset])
  useEffect(() => {
    if (values.type === "transfer") {
      setValue("mainCategoryId", "")
      setValue("subcategoryId", "")
    }
  }, [setValue, values.type])
  useEffect(() => {
    let active = true
    const isInitialCrossCurrencyValue = initialValues && open && values.type === initialValues.type && values.accountId === initialValues.accountId && values.toAccountId === initialValues.toAccountId && values.amount === initialValues.amount && values.receivedAmount === initialValues.receivedAmount
    if (!crossCurrency || !from || !to || !values.amount || isInitialCrossCurrencyValue) {
      setEstimateError(false)
      if (values.type === "transfer" && from && to && from.currency_code === to.currency_code) setValue("receivedAmount", values.amount ?? "")
      return
    }
    void estimateTransferReceived(values.amount, from, to)
      .then((amount) => {
        if (active) {
          setValue("receivedAmount", amount)
          setEstimateError(false)
        }
      })
      .catch(() => {
        if (active) setEstimateError(true)
      })
    return () => {
      active = false
    }
  }, [crossCurrency, from, initialValues, open, setValue, to, values.accountId, values.amount, values.receivedAmount, values.toAccountId, values.type])
  useEffect(() => {
    if (!open) {
      setVisibleViewport(null)
      return
    }

    if (!window.matchMedia("(max-width: 767px)").matches) return

    const viewport = window.visualViewport
    const scrollRegion = scrollRegionRef.current
    if (!viewport || !scrollRegion) return

    const revealFocusedControl = () => {
      const focused = document.activeElement
      if (!(focused instanceof HTMLElement) || !scrollRegion.contains(focused)) return
      const regionRect = scrollRegion.getBoundingClientRect()
      const focusedRect = focused.getBoundingClientRect()
      const inset = 16
      if (focusedRect.bottom > regionRect.bottom - inset) {
        scrollRegion.scrollBy({
          top: focusedRect.bottom - regionRect.bottom + inset,
          behavior: "smooth",
        })
      } else if (focusedRect.top < regionRect.top + inset) {
        scrollRegion.scrollBy({
          top: focusedRect.top - regionRect.top - inset,
          behavior: "smooth",
        })
      }
    }
    const updateViewport = () => {
      setVisibleViewport({ height: viewport.height, top: viewport.offsetTop })
      requestAnimationFrame(revealFocusedControl)
    }
    const handleFocusIn = () => {
      requestAnimationFrame(revealFocusedControl)
      window.setTimeout(revealFocusedControl, 250)
    }

    updateViewport()
    viewport.addEventListener("resize", updateViewport)
    viewport.addEventListener("scroll", updateViewport)
    scrollRegion.addEventListener("focusin", handleFocusIn)
    return () => {
      viewport.removeEventListener("resize", updateViewport)
      viewport.removeEventListener("scroll", updateViewport)
      scrollRegion.removeEventListener("focusin", handleFocusIn)
    }
  }, [open])
  const disabled = isSaving || isSubmitting
  const categoryPicker = (
    <RecordCategoryPicker
      value={{
        mainCategoryId: values.mainCategoryId ?? "",
        subcategoryId: values.subcategoryId ?? "",
      }}
      onChange={(category) => {
        setValue("mainCategoryId", category.mainCategoryId, {
          shouldValidate: true,
        })
        setValue("subcategoryId", category.subcategoryId, {
          shouldValidate: true,
        })
      }}
      error={errors.subcategoryId?.message}
    />
  )

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && !disabled && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[90] bg-black/60" />
        <Dialog.Popup
          style={
            visibleViewport
              ? {
                  maxHeight: Math.max(180, visibleViewport.height - 16),
                  top: visibleViewport.top + visibleViewport.height / 2,
                }
              : undefined
          }
          className="fixed top-1/2 left-1/2 z-[100] flex max-h-[calc(100dvh-1rem)] w-[min(46rem,calc(100vw-1rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:w-[min(46rem,calc(100vw-2rem))]"
        >
          <header className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-4 py-4 sm:px-6 sm:py-5">
            <Dialog.Title className="font-heading text-xl font-semibold">{t(initialValues ? "accounts.records.edit" : "accounts.records.add")}</Dialog.Title>
            <Dialog.Close render={<Button variant="ghost" size="icon" />}>
              <X size={18} />
            </Dialog.Close>
          </header>
          <form ref={scrollRegionRef} id="account-record-form" className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pt-4 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-5" onSubmit={handleSubmit(onSubmit)} noValidate>
            <fieldset>
              <legend className="text-sm font-semibold">{t("accounts.records.type")}</legend>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {recordTypeOptions.map((option) => {
                  const selected = values.type === option.value
                  return (
                    <button key={option.value} type="button" aria-pressed={selected} onClick={() => setValue("type", option.value)} className={`min-w-0 rounded-xl border px-2 py-2.5 text-sm font-semibold transition-colors focus-visible:ring-2 ${selected ? option.activeClassName : "border-[var(--color-border)] bg-[var(--color-surface)] text-muted-foreground hover:bg-[var(--color-surface-muted)]"}`}>
                      {t(option.labelKey)}
                    </button>
                  )
                })}
              </div>
            </fieldset>
            {values.type === "transfer" ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <AccountSelect label={t("accounts.records.fromAccount")} name="accountId" accounts={accounts} register={register} error={errors.accountId?.message} />
                  <AccountSelect label={t("accounts.records.toAccount")} name="toAccountId" accounts={accounts} register={register} error={errors.toAccountId?.message} />
                  <AmountField label={t("accounts.records.amountSent")} currency={from?.currency_code} register={register} error={errors.amount?.message} />
                  <DateTimeField register={register} error={errors.occurredAt?.message} />
                </div>
                {crossCurrency && <AmountField label={t("accounts.records.amountReceived")} currency={to?.currency_code} register={register} error={estimateError ? t("accounts.records.fxError") : errors.receivedAmount?.message} name="receivedAmount" />}
              </>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <AccountSelect label={t("accounts.records.account")} name="accountId" accounts={accounts} register={register} error={errors.accountId?.message} />
                {categoryPicker}
                <AmountField label={t("accounts.records.amount")} currency={from?.currency_code} register={register} error={errors.amount?.message} />
                <DateTimeField register={register} error={errors.occurredAt?.message} />
              </div>
            )}
            <div>
              <label className="text-sm font-semibold">{t("accounts.records.notes")}</label>
              <textarea className={field} rows={3} {...register("notes")} />
            </div>
            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}
          </form>
          <footer className="flex shrink-0 flex-wrap justify-between gap-2 border-t border-[var(--color-border)] px-4 py-3 sm:px-6 sm:py-4">
            {onDelete ? (
              <Button variant="destructive" onClick={onDelete} disabled={disabled}>
                {t("accounts.records.delete")}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                {t("common.cancel")}
              </Button>
              <Button form="account-record-form" type="submit" disabled={disabled || estimateError}>
                {t("accounts.records.save")}
              </Button>
            </div>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function AccountSelect({ label, name, accounts, register, error }: { label: string; name: "accountId" | "toAccountId"; accounts: AccountSummary[]; register: ReturnType<typeof useForm<AccountRecordFormValues>>["register"]; error?: string }) {
  return (
    <div>
      <label className="text-sm font-semibold">{label}</label>
      <select className={field} {...register(name)}>
        <option value="">—</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name} — {account.currency_code}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}
function AmountField({ label, currency, register, error, name = "amount" }: { label: string; currency?: string; register: ReturnType<typeof useForm<AccountRecordFormValues>>["register"]; error?: string; name?: "amount" | "receivedAmount" }) {
  return (
    <div>
      <label className="text-sm font-semibold">{label}</label>
      <div className="relative" dir="ltr">
        <input className={`${field} pe-16`} inputMode="decimal" dir="ltr" {...register(name)} />
        <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-muted-foreground" dir="ltr">
          {currency}
        </span>
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}
function DateTimeField({ register, error }: { register: ReturnType<typeof useForm<AccountRecordFormValues>>["register"]; error?: string }) {
  const { t } = useTranslation()
  return (
    <div>
      <label className="text-sm font-semibold">{t("accounts.records.dateTime")}</label>
      <input type="datetime-local" className={field} {...register("occurredAt")} />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}
