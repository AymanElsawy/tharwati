import { zodResolver } from "@hookform/resolvers/zod"
import { Dialog } from "@base-ui/react/dialog"
import { X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Controller, useForm, useWatch, type Control, type UseFormClearErrors, type UseFormTrigger } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { MoneyInput } from "@/components/MoneyInput"
import { visibleMoneyInputError } from "@/lib/formatting/money-input"
import { useTranslation } from "@/i18n/useTranslation"
import { getAccountPickerOptions } from "@/features/accounts/utils/account-display-label"
import { formatLocalDateTimeInput } from "@/lib/formatting/local-date-time"
import type { AccountSummary } from "@/lib/supabase/types"
import { createAccountRecordSchema } from "../schemas/account-record.schema"
import { estimateTransferReceived } from "../services/account-records.service"
import { isAccountRecordFormDirty } from "../utils/account-record-form-dirty"
import { normalizeTransferValues } from "../utils/transfer-form-values"
import { createTransferFxRequestGate, invalidateTransferFxPreview, isValidTransferSentAmount, requestTransferFxPreview } from "../utils/transfer-fx-preview"
import {
  emptyAccountRecordFormValues,
  type AccountRecordFormValues,
  type AccountRecordType,
} from "../types/account-record"
import { RecordCategoryPicker } from "./RecordCategoryPicker"
import { TransferAccountSelectors } from "./TransferAccountSelectors"

const field =
  "mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm"
const recordTypeOptions: Array<{
  value: AccountRecordType
  labelKey:
    | "accounts.records.income"
    | "accounts.records.expense"
    | "accounts.records.transfer"
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

export function AccountRecordFormDialog({
  open,
  initialAccount,
  accounts,
  initialValues,
  isSaving,
  error,
  onClose,
  onSubmit,
  onDelete,
  onRecordRefund,
}: {
  open: boolean
  initialAccount: AccountSummary | null
  accounts: AccountSummary[]
  initialValues?: AccountRecordFormValues
  isSaving: boolean
  error?: string | null
  onClose: () => void
  onSubmit: (values: AccountRecordFormValues) => Promise<void>
  onDelete?: () => void
  onRecordRefund?: () => void
}) {
  const { t } = useTranslation()
  const schema = useMemo(() => createAccountRecordSchema(t), [t])
  const {
    control,
    register,
    reset,
    setValue,
    clearErrors,
    trigger,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty, submitCount },
  } = useForm<AccountRecordFormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyAccountRecordFormValues,
  })
  const values = useWatch({
    control,
    defaultValue: emptyAccountRecordFormValues,
  })
  const recordType = values.type ?? "expense"
  const fromAccountId = values.accountId ?? ""
  const toAccountId = values.toAccountId ?? ""
  const [failedEstimateKey, setFailedEstimateKey] = useState<string | null>(
    null
  )
  const fxRequestGate = useRef(createTransferFxRequestGate())
  const previewEditedRef = useRef(false)
  const scrollRegionRef = useRef<HTMLFormElement>(null)
  const [visibleViewport, setVisibleViewport] = useState<{
    height: number
    top: number
  } | null>(null)
  const from = accounts.find((account) => account.id === fromAccountId) ?? null
  const to = accounts.find((account) => account.id === toAccountId) ?? null
  const crossCurrency =
    recordType === "transfer" &&
    from &&
    to &&
    from.currency_code !== to.currency_code
  const estimateKey = crossCurrency
    ? `${fromAccountId}:${toAccountId}:${values.amount ?? ""}`
    : null
  const estimateError =
    estimateKey !== null && failedEstimateKey === estimateKey
  const validSentAmount = isValidTransferSentAmount(values.amount ?? "")
  const invalidateFxPreview = () => {
    previewEditedRef.current = true
    invalidateTransferFxPreview(fxRequestGate.current, () => {
      setValue("receivedAmount", "")
      clearErrors("receivedAmount")
    })
    setFailedEstimateKey(null)
  }
  useEffect(() => {
    if (open) {
      fxRequestGate.current.invalidate()
      previewEditedRef.current = false
      reset(
        normalizeTransferValues(
          initialValues ?? {
            ...emptyAccountRecordFormValues,
            accountId: initialAccount?.id ?? "",
            occurredAt: formatLocalDateTimeInput(),
          }
        )
      )
    }
  }, [initialAccount, initialValues, open, reset])
  useEffect(() => {
    if (recordType === "transfer") {
      setValue("mainCategoryId", "")
      setValue("subcategoryId", "")
    }
  }, [recordType, setValue])
  useEffect(() => {
    const isInitialCrossCurrencyValue =
      initialValues &&
      !previewEditedRef.current &&
      open &&
      recordType === initialValues.type &&
      fromAccountId === initialValues.accountId &&
      toAccountId === initialValues.toAccountId &&
      values.amount === initialValues.amount
    if (
      !crossCurrency ||
      !from ||
      !to ||
      !values.amount ||
      !validSentAmount ||
      isInitialCrossCurrencyValue
    ) {
      if (
        recordType === "transfer" &&
        from &&
        to &&
        from.currency_code === to.currency_code
      )
        setValue("receivedAmount", values.amount ?? "")
      return
    }
    return requestTransferFxPreview({
      amount: values.amount,
      gate: fxRequestGate.current,
      estimate: (amount) => estimateTransferReceived(amount, from, to),
      onReceived: (amount) => {
        setValue("receivedAmount", amount, { shouldValidate: true })
        setFailedEstimateKey(null)
      },
      onUnavailable: () => setFailedEstimateKey(estimateKey),
    })
  }, [
    crossCurrency,
    estimateKey,
    from,
    initialValues,
    open,
    setValue,
    to,
    fromAccountId,
    values.amount,
    validSentAmount,
    toAccountId,
    recordType,
  ])
  useEffect(() => {
    if (!open) return

    if (!window.matchMedia("(max-width: 767px)").matches) return

    const viewport = window.visualViewport
    const scrollRegion = scrollRegionRef.current
    if (!viewport || !scrollRegion) return

    const revealFocusedControl = () => {
      const focused = document.activeElement
      if (!(focused instanceof HTMLElement) || !scrollRegion.contains(focused))
        return
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
  const transferSelectionIncomplete =
    recordType === "transfer" &&
    (!fromAccountId || !toAccountId || fromAccountId === toAccountId)
  const hasUnsavedChanges = initialValues
    ? isAccountRecordFormDirty(values, initialValues)
    : isDirty
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
    <Dialog.Root
      open={open}
      onOpenChange={(next) => !next && !disabled && onClose()}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[90] bg-black/60" />
        <Dialog.Popup
          style={
            open &&
            visibleViewport &&
            typeof window !== "undefined" &&
            window.matchMedia("(max-width: 767px)").matches
              ? {
                  maxHeight: Math.max(180, visibleViewport.height - 16),
                  top: visibleViewport.top + visibleViewport.height / 2,
                }
              : undefined
          }
          className="fixed top-1/2 left-1/2 z-[100] flex max-h-[calc(100dvh-1rem)] w-[min(46rem,calc(100vw-1rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:w-[min(46rem,calc(100vw-2rem))]"
        >
          <header className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-4 py-4 sm:px-6 sm:py-5">
            <Dialog.Title className="font-heading text-xl font-semibold">
              {t(
                initialValues ? "accounts.records.edit" : "accounts.records.add"
              )}
            </Dialog.Title>
            <Dialog.Close render={<Button variant="ghost" size="icon" />}>
              <X size={18} />
            </Dialog.Close>
          </header>
          <form
            ref={scrollRegionRef}
            id="account-record-form"
            className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pt-4 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-5"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
          >
            <fieldset>
              <legend className="text-sm font-semibold">
                {t("accounts.records.type")}
              </legend>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {recordTypeOptions.map((option) => {
                  const selected = recordType === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        if (option.value !== recordType) invalidateFxPreview()
                        if (
                          option.value === "transfer" &&
                          recordType !== "transfer"
                        )
                          setValue("toAccountId", "", { shouldValidate: true })
                        setValue("type", option.value, { shouldValidate: true })
                      }}
                      className={`min-w-0 rounded-xl border px-2 py-2.5 text-sm font-semibold transition-colors focus-visible:ring-2 ${selected ? option.activeClassName : "border-[var(--color-border)] bg-[var(--color-surface)] text-muted-foreground hover:bg-[var(--color-surface-muted)]"}`}
                    >
                      {t(option.labelKey)}
                    </button>
                  )
                })}
              </div>
            </fieldset>
            {recordType === "transfer" ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <TransferAccountSelectors
                    accounts={accounts}
                    fromAccountId={fromAccountId}
                    toAccountId={toAccountId}
                    fromError={errors.accountId?.message}
                    toError={errors.toAccountId?.message}
                    onFromAccountChange={(accountId) => {
                      invalidateFxPreview()
                      setValue("accountId", accountId, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                      if (accountId === toAccountId)
                        setValue("toAccountId", "", {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                    }}
                    onToAccountChange={(accountId) => {
                      invalidateFxPreview()
                      setValue("toAccountId", accountId, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                      if (accountId === fromAccountId)
                        setValue("accountId", "", {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                    }}
                  />
                  <AmountField
                    label={t("accounts.records.amountSent")}
                    currency={from?.currency_code}
                    control={control}
                    clearErrors={clearErrors}
                    trigger={trigger}
                    submitCount={submitCount}
                    onAmountChange={invalidateFxPreview}
                    error={errors.amount?.message}
                  />
                  <DateTimeField
                    register={register}
                    error={errors.occurredAt?.message}
                  />
                </div>
                {crossCurrency && (
                  <AmountField
                    label={t("accounts.records.amountReceived")}
                    currency={to?.currency_code}
                    control={control}
                    clearErrors={clearErrors}
                    trigger={trigger}
                    submitCount={submitCount}
                    disabled={!validSentAmount}
                    error={
                      estimateError
                        ? t("accounts.records.fxError")
                        : validSentAmount ? errors.receivedAmount?.message : undefined
                    }
                    name="receivedAmount"
                  />
                )}
              </>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <AccountSelect
                  label={t("accounts.records.account")}
                  name="accountId"
                  accounts={accounts}
                  register={register}
                  error={errors.accountId?.message}
                />
                {categoryPicker}
                <AmountField
                  label={t("accounts.records.amount")}
                  currency={from?.currency_code}
                  control={control}
                  clearErrors={clearErrors}
                  trigger={trigger}
                  submitCount={submitCount}
                  error={errors.amount?.message}
                />
                <DateTimeField
                  register={register}
                  error={errors.occurredAt?.message}
                />
              </div>
            )}
            <div>
              <label className="text-sm font-semibold">
                {t("accounts.records.notes")}
              </label>
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
              <Button
                variant="destructive"
                onClick={onDelete}
                disabled={disabled}
              >
                {t("accounts.records.delete")}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              {onRecordRefund && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={disabled || hasUnsavedChanges}
                  title={
                    hasUnsavedChanges
                      ? t("accounts.records.saveBeforeRefund")
                      : undefined
                  }
                  onClick={onRecordRefund}
                >
                  {t("accounts.records.recordRefund")}
                </Button>
              )}
              <Button variant="outline" onClick={onClose}>
                {t("common.cancel")}
              </Button>
              <Button
                form="account-record-form"
                type="submit"
                disabled={
                  disabled || estimateError || transferSelectionIncomplete ||
                  (recordType === "transfer" && !validSentAmount)
                }
              >
                {t("accounts.records.save")}
              </Button>
            </div>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function AccountSelect({
  label,
  name,
  accounts,
  register,
  error,
}: {
  label: string
  name: "accountId" | "toAccountId"
  accounts: AccountSummary[]
  register: ReturnType<typeof useForm<AccountRecordFormValues>>["register"]
  error?: string
}) {
  const { t } = useTranslation()
  return (
    <div>
      <label className="text-sm font-semibold">{label}</label>
      <select className={field} {...register(name)}>
        <option value="">—</option>
        {getAccountPickerOptions(accounts, t).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}

function AmountField({
  label,
  currency,
  control,
  clearErrors,
  trigger,
  submitCount,
  disabled,
  onAmountChange,
  error,
  name = "amount",
}: {
  label: string
  currency?: string
  control: Control<AccountRecordFormValues>
  clearErrors: UseFormClearErrors<AccountRecordFormValues>
  trigger: UseFormTrigger<AccountRecordFormValues>
  submitCount: number
  disabled?: boolean
  onAmountChange?: () => void
  error?: string
  name?: "amount" | "receivedAmount"
}) {
  const value = useWatch({ control, name }) ?? ""
  const [suppressedAtSubmitCount, setSuppressedAtSubmitCount] = useState<number | null>(null)
  const visibleError = visibleMoneyInputError(
    value,
    error,
    suppressedAtSubmitCount !== null && submitCount <= suppressedAtSubmitCount
  )
  return (
    <div>
      <label className="text-sm font-semibold">{label}</label>
      <div className="relative" dir="ltr">
        <Controller name={name} control={control} render={({ field: amountField }) => (
          <MoneyInput
            className={`${field} pe-16`}
            dir="ltr"
            name={amountField.name}
            ref={amountField.ref}
            disabled={disabled}
            value={amountField.value}
            onValueChange={(value) => {
              onAmountChange?.()
              amountField.onChange(value)
              setSuppressedAtSubmitCount(value === "" ? submitCount : null)
              clearErrors(name)
              if (value !== "") void trigger(name)
            }}
            onBlur={() => {
              setSuppressedAtSubmitCount(null)
              amountField.onBlur()
              clearErrors(name)
              void trigger(name)
            }}
          />
        )} />
        <span
          className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-muted-foreground"
          dir="ltr"
        >
          {currency}
        </span>
      </div>
      {visibleError && <p className="mt-1 text-sm text-red-600">{visibleError}</p>}
    </div>
  )
}
function DateTimeField({
  register,
  error,
}: {
  register: ReturnType<typeof useForm<AccountRecordFormValues>>["register"]
  error?: string
}) {
  const { t } = useTranslation()
  return (
    <div>
      <label className="text-sm font-semibold">
        {t("accounts.records.dateTime")}
      </label>
      <input
        type="datetime-local"
        className={field}
        {...register("occurredAt")}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}
