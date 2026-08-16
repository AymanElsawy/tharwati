import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useMemo } from "react"
import { useForm, useWatch } from "react-hook-form"

import { useTranslation } from "../../../i18n/useTranslation"
import { createAccountSchema } from "../schemas/account.schema"
import { hasMeaningfulAccountChanges, mergeWatchedAccountForm } from "../utils/account-form-state"
import {
  bankSubtypeOptions,
  currencyOptions,
  getBalanceLabelKey,
  getPurityOptions,
  getTotalMetalAmount,
  investmentTypeOptions,
  metalTypeOptions,
  propertyTypeOptions,
  type AccountFormValues,
} from "../types/account-form"
import { formatPortfolioAmount } from "../../portfolio/utils/portfolio-formatters"
import type { TranslationKey } from "../../../i18n/en/translations"

type AccountFormProps = {
  defaultValues: AccountFormValues
  formId: string
  isSaving: boolean
  isCurrencyLocked: boolean
  isOpeningBalanceLocked: boolean
  onSubmit: (values: AccountFormValues) => Promise<void>
  onDirtyChange: (dirty: boolean) => void
}

const fieldClassName =
  "mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-soft)] disabled:cursor-not-allowed disabled:opacity-60"
const labelClassName = "text-sm font-semibold text-[var(--color-text-primary)]"
const errorClassName = "mt-1.5 text-sm text-red-600 dark:text-red-400"

export function AccountForm({
  defaultValues,
  formId,
  isSaving,
  isCurrencyLocked,
  isOpeningBalanceLocked,
  onSubmit,
  onDirtyChange,
}: AccountFormProps) {
  const { t, language } = useTranslation()
  const locale = language === "ar" ? "ar-SA" : "en-US"
  const accountSchema = useMemo(() => createAccountSchema(t), [t])
  const {
    formState: { errors, isSubmitting, isSubmitted },
    handleSubmit,
    register,
    reset,
    control,
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues,
  })

  const showError = (field: keyof AccountFormValues) =>
    Boolean(errors[field]) && isSubmitted

  useEffect(() => {
    reset(defaultValues)
    onDirtyChange(false)
  }, [defaultValues, onDirtyChange, reset])

  const values = useWatch({ control, defaultValue: defaultValues })
  useEffect(() => { onDirtyChange(hasMeaningfulAccountChanges(mergeWatchedAccountForm(values, defaultValues), defaultValues)) }, [defaultValues, onDirtyChange, values])

  const accountTypeCode = defaultValues.accountTypeCode
  const isDisabled = isSaving || isSubmitting
  const showBalance = accountTypeCode !== "gold"
  const metalType = (values?.metalType ?? defaultValues.metalType) as AccountFormValues["metalType"]
  const purityOptions = getPurityOptions(metalType)
  const totalMetalAmount = getTotalMetalAmount(mergeWatchedAccountForm(values, defaultValues))
  const currencyCode = values?.currencyCode ?? defaultValues.currencyCode

  return (
    <form
      id={formId}
      className="space-y-5"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      <input type="hidden" {...register("accountTypeCode")} />

      <div>
        <label htmlFor={`${formId}-name`} className={labelClassName}>
          {t("accounts.form.name")}
        </label>
        <input
          id={`${formId}-name`}
          className={fieldClassName}
          disabled={isDisabled}
          autoComplete="off"
          {...register("name")}
        />
        {showError("name") ? <p className={errorClassName}>{errors.name?.message}</p> : null}
      </div>

      <div>
        <label htmlFor={`${formId}-currency`} className={labelClassName}>
          {t("accounts.form.currency")}
        </label>
        {isCurrencyLocked ? (
          <>
            <input type="hidden" {...register("currencyCode")} />
            <div
              id={`${formId}-currency`}
              className={`${fieldClassName} cursor-not-allowed opacity-60`}
              aria-readonly="true"
            >
              {t(
                currencyOptions.find(
                  (option) => option.value === defaultValues.currencyCode,
                )?.labelKey ?? "accounts.form.currency",
              )}
            </div>
            <p className="mt-1.5 text-xs text-[var(--color-text-secondary)]">
              {t("accounts.form.currencyLocked")}
            </p>
          </>
        ) : (
          <select
            id={`${formId}-currency`}
            className={fieldClassName}
            disabled={isDisabled}
            {...register("currencyCode")}
          >
            {currencyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        )}
      </div>

      {accountTypeCode === "bank" ? (
        <div>
          <label htmlFor={`${formId}-bank-subtype`} className={labelClassName}>
            {t("accounts.form.bankSubtype.label")}
          </label>
          <select
            id={`${formId}-bank-subtype`}
            className={fieldClassName}
            disabled={isDisabled}
            {...register("bankSubtype")}
          >
            <option value="">{t("accounts.form.selectPlaceholder")}</option>
            {bankSubtypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
          {showError("bankSubtype") ? <p className={errorClassName}>{errors.bankSubtype?.message}</p> : null}
        </div>
      ) : null}

      {accountTypeCode === "brokerage" ? (
        <div>
          <label htmlFor={`${formId}-investment-type`} className={labelClassName}>
            {t("accounts.form.investmentType.label")}
          </label>
          <select
            id={`${formId}-investment-type`}
            className={fieldClassName}
            disabled={isDisabled}
            {...register("investmentType")}
          >
            <option value="">{t("accounts.form.selectPlaceholder")}</option>
            {investmentTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
          {showError("investmentType") ? <p className={errorClassName}>{errors.investmentType?.message}</p> : null}
        </div>
      ) : null}

      {accountTypeCode === "real_estate" ? (
        <div>
          <label htmlFor={`${formId}-property-type`} className={labelClassName}>
            {t("accounts.form.propertyType.label")}
          </label>
          <select
            id={`${formId}-property-type`}
            className={fieldClassName}
            disabled={isDisabled}
            {...register("propertyType")}
          >
            <option value="">{t("accounts.form.selectPlaceholder")}</option>
            {propertyTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
          {showError("propertyType") ? <p className={errorClassName}>{errors.propertyType?.message}</p> : null}
        </div>
      ) : null}

      {accountTypeCode === "business" ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor={`${formId}-business-type`} className={labelClassName}>
              {t("accounts.form.businessType")}
            </label>
            <input
              id={`${formId}-business-type`}
              className={fieldClassName}
              disabled={isDisabled}
              autoComplete="off"
              {...register("businessType")}
            />
            {showError("businessType") ? <p className={errorClassName}>{errors.businessType?.message}</p> : null}
          </div>
          <div>
            <label htmlFor={`${formId}-industry`} className={labelClassName}>
              {t("accounts.form.industry")}
            </label>
            <input
              id={`${formId}-industry`}
              className={fieldClassName}
              disabled={isDisabled}
              autoComplete="off"
              {...register("industry")}
            />
            {showError("industry") ? <p className={errorClassName}>{errors.industry?.message}</p> : null}
          </div>
        </div>
      ) : null}

      {accountTypeCode === "real_estate" || accountTypeCode === "business" ? (
        <div>
          <label htmlFor={`${formId}-ownership`} className={labelClassName}>
            {t("accounts.form.ownershipPercentage")}
          </label>
          <div className="relative mt-1.5">
            <input
              id={`${formId}-ownership`}
              className={`${fieldClassName} mt-0 pe-9`}
              disabled={isDisabled}
              inputMode="decimal"
              dir="ltr"
              placeholder="100"
              {...register("ownershipPercentage")}
            />
            <span className="text-muted-foreground pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 text-sm">
              %
            </span>
          </div>
          {showError("ownershipPercentage") ? <p className={errorClassName}>{errors.ownershipPercentage?.message}</p> : null}
        </div>
      ) : null}

      {accountTypeCode === "gold" ? (
        <>
          <div>
            <label htmlFor={`${formId}-metal-type`} className={labelClassName}>
              {t("accounts.form.metalType.label")}
            </label>
            <select
              id={`${formId}-metal-type`}
              className={fieldClassName}
              disabled={isDisabled}
              {...register("metalType")}
            >
              <option value="">{t("accounts.form.selectPlaceholder")}</option>
              {metalTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
            {showError("metalType") ? <p className={errorClassName}>{errors.metalType?.message}</p> : null}
          </div>

          <div>
            <label htmlFor={`${formId}-purity`} className={labelClassName}>
              {t("accounts.form.purity.label")}
            </label>
            <select
              id={`${formId}-purity`}
              className={fieldClassName}
              disabled={isDisabled || !metalType}
              {...register("purity")}
            >
              <option value="">{t("accounts.form.selectPlaceholder")}</option>
              {purityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label ?? t(option.labelKey as TranslationKey)}
                </option>
              ))}
            </select>
            {showError("purity") ? <p className={errorClassName}>{errors.purity?.message}</p> : null}
          </div>

          <div>
            <label htmlFor={`${formId}-purchase-date`} className={labelClassName}>
              {t("accounts.form.purchaseDate")}
            </label>
            <input
              id={`${formId}-purchase-date`}
              type="date"
              className={fieldClassName}
              disabled={isDisabled}
              dir="ltr"
              {...register("purchaseDate")}
            />
            {showError("purchaseDate") ? <p className={errorClassName}>{errors.purchaseDate?.message}</p> : null}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor={`${formId}-balance-grams`} className={labelClassName}>
                {t("accounts.form.balanceGrams")}
              </label>
              <div className="relative mt-1.5">
                <input
                  id={`${formId}-balance-grams`}
                  className={`${fieldClassName} mt-0 pe-9`}
                  disabled={isDisabled}
                  inputMode="decimal"
                  dir="ltr"
                  placeholder="0.000"
                  {...register("balanceGrams")}
                />
                <span className="text-muted-foreground pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 text-sm">
                  g
                </span>
              </div>
              {showError("balanceGrams") ? <p className={errorClassName}>{errors.balanceGrams?.message}</p> : null}
            </div>

            <div>
              <label htmlFor={`${formId}-cost-per-unit`} className={labelClassName}>
                {t("accounts.form.costPerUnit")}
              </label>
              <input
                id={`${formId}-cost-per-unit`}
                className={`${fieldClassName} mt-1.5`}
                disabled={isDisabled}
                inputMode="decimal"
                dir="ltr"
                placeholder="0.00"
                {...register("costPerUnit")}
              />
              {showError("costPerUnit") ? <p className={errorClassName}>{errors.costPerUnit?.message}</p> : null}
            </div>
          </div>

          <div>
            <span className={labelClassName}>{t("accounts.form.totalAmount")}</span>
            <div
              className={`${fieldClassName} cursor-not-allowed opacity-60`}
              aria-readonly="true"
              dir="ltr"
            >
              {formatPortfolioAmount(totalMetalAmount, currencyCode, locale)}
            </div>
          </div>
        </>
      ) : null}

      {showBalance ? (
        <div>
          <label htmlFor={`${formId}-opening-balance`} className={labelClassName}>
            {t(getBalanceLabelKey(accountTypeCode))}
          </label>
          {isOpeningBalanceLocked ? (
            <>
              <input type="hidden" {...register("openingBalance")} />
              <div
                id={`${formId}-opening-balance`}
                className={`${fieldClassName} cursor-not-allowed opacity-60`}
                aria-readonly="true"
                dir="ltr"
              >
                {defaultValues.openingBalance}
              </div>
              <p className="mt-1.5 text-xs text-[var(--color-text-secondary)]">
                {t("accounts.form.openingBalanceLocked")}
              </p>
            </>
          ) : (
            <input
              id={`${formId}-opening-balance`}
              className={fieldClassName}
              disabled={isDisabled}
              inputMode="decimal"
              dir="ltr"
              placeholder="0.00"
              {...register("openingBalance")}
            />
          )}
          {showError("openingBalance") ? <p className={errorClassName}>{errors.openingBalance?.message}</p> : null}
        </div>
      ) : null}

      {accountTypeCode === "other" ? (
        <div>
          <label htmlFor={`${formId}-notes`} className={labelClassName}>
            {t("accounts.form.notes")}
            <span className="ms-1 font-normal text-[var(--color-text-secondary)]">
              ({t("common.optional")})
            </span>
          </label>
          <textarea
            id={`${formId}-notes`}
            className={`${fieldClassName} min-h-24 resize-y`}
            disabled={isDisabled}
            {...register("notes")}
          />
        </div>
      ) : null}

      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
        <input
          type="checkbox"
          className="size-4 accent-[var(--color-primary)]"
          disabled={isDisabled}
          {...register("isActive")}
          
        />
        <span>
          <span className="block text-sm font-semibold text-[var(--color-text-primary)]">
            {t("accounts.form.active")}
          </span>
          <span className="block text-xs text-[var(--color-text-secondary)]">
            {t("accounts.form.activeDescription")}
          </span>
        </span>
      </label>
    </form>
  )
  
}
