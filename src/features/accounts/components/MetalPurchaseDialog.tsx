import { zodResolver } from "@hookform/resolvers/zod"
import { Dialog } from "@base-ui/react/dialog"
import { X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useForm, useWatch } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { useTranslation } from "@/i18n/useTranslation"
import { getAccountPickerOptions } from "@/features/accounts/utils/account-display-label"
import type { AccountSummary } from "@/lib/supabase/types"
import { formatPortfolioAmount } from "@/features/portfolio/utils/portfolio-formatters"
import { formatLocalDateTimeInput } from "@/lib/formatting/local-date-time"
import {
  addMetalPurchase,
  getEligibleMetalFundingAccounts,
} from "../services/metal-purchases.service"
import { createMetalPurchaseSchema } from "../schemas/metal-purchase.schema"
import { getPurityOptions } from "../types/account-form"
import {
  emptyMetalPurchaseFormValues,
  getMetalPurchaseSubtotal,
  getMetalPurchaseTotal,
  type MetalPurchaseFormValues,
} from "../types/metal-purchase"

const fieldClassName =
  "mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-soft)]"
const labelClassName = "text-sm font-semibold text-[var(--color-text-primary)]"
const errorClassName = "mt-1.5 text-sm text-red-600 dark:text-red-400"

export function MetalPurchaseDialog({
  account,
  fundingAccounts,
  initialPurity,
  initialValues,
  isSaving,
  error,
  onClose,
  onSubmit,
  onDelete,
}: {
  account: AccountSummary | null
  fundingAccounts: AccountSummary[]
  initialPurity?: string
  initialValues?: MetalPurchaseFormValues
  isSaving: boolean
  error?: string | null
  onClose: () => void
  onSubmit: (values: MetalPurchaseFormValues) => Promise<void>
  onDelete?: () => void
}) {
  const { t, language } = useTranslation()
  const metalType = account?.metal_type === "silver" ? "silver" : "gold"
  const schema = useMemo(
    () => createMetalPurchaseSchema(metalType, t),
    [metalType, t]
  )
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<MetalPurchaseFormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyMetalPurchaseFormValues,
  })
  const values = useWatch({
    control,
    defaultValue: emptyMetalPurchaseFormValues,
  })
  const formValues = {
    ...emptyMetalPurchaseFormValues,
    ...values,
  }
  const subtotal = getMetalPurchaseSubtotal(formValues)
  const total = getMetalPurchaseTotal(formValues)
  const disabled = isSaving || isSubmitting

  useEffect(() => {
    if (account) {
      reset({
        ...emptyMetalPurchaseFormValues,
        ...initialValues,
        purchaseDate: initialValues?.purchaseDate ?? formatLocalDateTimeInput(),
        purity: getPurityOptions(metalType).some(
          (option) => option.value === (initialValues?.purity ?? initialPurity)
        )
          ? (initialValues?.purity ?? initialPurity)
          : "",
      })
    }
  }, [account, initialPurity, initialValues, metalType, reset])

  return (
    <Dialog.Root
      open={account !== null}
      onOpenChange={(open) => {
        if (!open && !disabled) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[70] bg-black/60" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-[80] flex max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
          <header className="flex items-start justify-between border-b border-[var(--color-border)] px-6 py-5">
            <div>
              <Dialog.Title className="font-heading text-xl font-semibold">
                {initialValues
                  ? t("accounts.metalPurchase.edit")
                  : t("accounts.metalPurchase.title", {
                      metal: account?.name ?? "",
                    })}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                {account?.currency_code}
              </Dialog.Description>
            </div>
            <Dialog.Close
              disabled={disabled}
              render={<Button variant="ghost" size="icon" />}
            >
              <X size={18} />
            </Dialog.Close>
          </header>
          <form
            id="metal-purchase-form"
            className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5"
            onSubmit={handleSubmit(async (formValues) => {
              await onSubmit(formValues)
              reset({
                ...emptyMetalPurchaseFormValues,
                purchaseDate: formatLocalDateTimeInput(),
              })
            })}
            noValidate
          >
            <div>
              <label className={labelClassName} htmlFor="metal-purchase-purity">
                {t("accounts.form.purity.label")}
              </label>
              <select
                id="metal-purchase-purity"
                className={fieldClassName}
                disabled={disabled}
                {...register("purity")}
              >
                <option value="">{t("accounts.form.selectPlaceholder")}</option>
                {getPurityOptions(metalType).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label ?? t(option.labelKey!)}
                  </option>
                ))}
              </select>
              {errors.purity ? (
                <p className={errorClassName}>{errors.purity.message}</p>
              ) : null}
            </div>
            <div>
              <label className={labelClassName} htmlFor="metal-purchase-date">
                {t("accounts.records.dateTime")}
              </label>
              <input
                id="metal-purchase-date"
                type="datetime-local"
                className={fieldClassName}
                disabled={disabled}
                {...register("purchaseDate")}
              />
              {errors.purchaseDate ? (
                <p className={errorClassName}>{errors.purchaseDate.message}</p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  className={labelClassName}
                  htmlFor="metal-purchase-grams"
                >
                  {t("accounts.form.balanceGrams")}
                </label>
                <input
                  id="metal-purchase-grams"
                  inputMode="decimal"
                  className={fieldClassName}
                  disabled={disabled}
                  {...register("unitsGrams")}
                />
                {errors.unitsGrams ? (
                  <p className={errorClassName}>{errors.unitsGrams.message}</p>
                ) : null}
              </div>
              <div>
                <label className={labelClassName} htmlFor="metal-purchase-cost">
                  {t("accounts.form.costPerUnit")}
                </label>
                <input
                  id="metal-purchase-cost"
                  inputMode="decimal"
                  className={fieldClassName}
                  disabled={disabled}
                  {...register("costPerUnit")}
                />
                {errors.costPerUnit ? (
                  <p className={errorClassName}>{errors.costPerUnit.message}</p>
                ) : null}
              </div>
            </div>
            <div>
              <label className={labelClassName} htmlFor="metal-purchase-fees">
                {t("accounts.metalPurchase.fees")}
              </label>
              <input
                id="metal-purchase-fees"
                inputMode="decimal"
                className={fieldClassName}
                disabled={disabled}
                {...register("fees")}
              />
              {errors.fees ? (
                <p className={errorClassName}>{errors.fees.message}</p>
              ) : null}
            </div>
            <div className="rounded-xl border border-[var(--color-border)] p-4">
              <label className="flex items-center justify-between gap-4">
                <span className={labelClassName}>
                  {t("accounts.metalPurchase.paidFrom")}
                </span>
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--color-primary)]"
                  disabled={disabled}
                  {...register("paidFromAccount")}
                />
              </label>
              {values.paidFromAccount ? (
                <div className="mt-4">
                  <select
                    className={fieldClassName}
                    disabled={disabled}
                    {...register("fundingAccountId")}
                  >
                    <option value="">
                      {t("accounts.form.selectPlaceholder")}
                    </option>
                    {getAccountPickerOptions(fundingAccounts, t).map(
                      (option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      )
                    )}
                  </select>
                  {errors.fundingAccountId ? (
                    <p className={errorClassName}>
                      {errors.fundingAccountId.message}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div>
              <span className={labelClassName}>
                {t("accounts.metalPurchase.subtotal")}
              </span>
              <div className={`${fieldClassName} opacity-60`} dir="ltr">
                {formatPortfolioAmount(
                  subtotal,
                  account?.currency_code ?? "USD",
                  language === "ar" ? "ar-SA" : "en-US"
                )}
              </div>
            </div>
            <div>
              <span className={labelClassName}>
                {t("accounts.metalPurchase.totalCost")}
              </span>
              <div className={`${fieldClassName} opacity-60`} dir="ltr">
                {formatPortfolioAmount(
                  total,
                  account?.currency_code ?? "USD",
                  language === "ar" ? "ar-SA" : "en-US"
                )}
              </div>
            </div>
            <div>
              <label className={labelClassName} htmlFor="metal-purchase-notes">
                {t("accounts.records.notes")}
              </label>
              <textarea
                id="metal-purchase-notes"
                rows={3}
                className={fieldClassName}
                disabled={disabled}
                {...register("notes")}
              />
            </div>
            {error ? (
              <p role="alert" className={errorClassName}>
                {error}
              </p>
            ) : null}
          </form>
          <footer className="flex flex-wrap justify-between gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface-muted)] px-6 py-4">
            {onDelete ? (
              <Button
                variant="destructive"
                disabled={disabled}
                onClick={onDelete}
              >
                {t("accounts.metalPurchase.delete")}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" disabled={disabled} onClick={onClose}>
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                form="metal-purchase-form"
                disabled={disabled}
              >
                {disabled
                  ? t("accounts.form.saving")
                  : initialValues
                    ? t("accounts.metalPurchase.save")
                    : t("accounts.metalPurchase.add")}
              </Button>
            </div>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function MetalPurchaseEntryDialog({
  account,
  initialPurity,
  accounts,
  onClose,
  onSaved,
}: {
  account: AccountSummary | null
  initialPurity?: string
  accounts: readonly AccountSummary[]
  onClose: () => void
  onSaved?: () => Promise<void> | void
}) {
  const [isSaving, setIsSaving] = useState(false)

  return (
    <MetalPurchaseDialog
      account={account}
      fundingAccounts={getEligibleMetalFundingAccounts(
        accounts,
        account?.currency_code
      )}
      initialPurity={initialPurity}
      isSaving={isSaving}
      onClose={onClose}
      onSubmit={async (values) => {
        if (!account) return
        setIsSaving(true)
        try {
          await addMetalPurchase(account.id, values)
          await onSaved?.()
          window.dispatchEvent(new Event("tharwati:data-changed"))
          onClose()
        } finally {
          setIsSaving(false)
        }
      }}
    />
  )
}
