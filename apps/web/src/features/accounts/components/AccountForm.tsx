import { zodResolver } from "@hookform/resolvers/zod"
import { Landmark, UserRound } from "lucide-react"
import { useEffect, useMemo } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"

import { useTranslation } from "../../../i18n/useTranslation"
import { createAccountSchema } from "../schemas/account.schema"
import {
  hasMeaningfulAccountChanges,
  mergeWatchedAccountForm,
} from "../utils/account-form-state"
import {
  bankSubtypeOptions,
  businessTypeOptions,
  currencyOptions,
  dueDayOfMonthOptions,
  getBalanceLabelKey,
  investmentTypeOptions,
  industryOptions,
  metalTypeOptions,
  propertyTypeOptions,
  type AccountFormValues,
} from "../types/account-form"
import { valuationMethodOptionsByAccountType } from "../types/valuation-method"
import { BusinessIndustrySelector } from "./BusinessIndustrySelector"

type AccountFormProps = {
  defaultValues: AccountFormValues
  formId: string
  isSaving: boolean
  isCurrencyLocked: boolean
  isOpeningBalanceLocked: boolean
  mode: "create" | "edit"
  onSubmit: (values: AccountFormValues) => Promise<void>
  onDirtyChange: (dirty: boolean) => void
}

const fieldClassName =
  "mt-1.5 min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm text-[var(--color-text-primary)] shadow-xs outline-none transition placeholder:text-muted-foreground/70 hover:border-[var(--color-primary)]/35 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-soft)] disabled:cursor-not-allowed disabled:bg-[var(--color-surface-muted)] disabled:opacity-70"
const labelClassName =
  "text-sm font-semibold tracking-tight text-[var(--color-text-primary)]"
const errorClassName = "mt-1.5 text-sm text-red-600 dark:text-red-400"

function FormSectionHeading({
  title,
  description,
  accent,
}: {
  title: string
  description?: string
  accent?: "business" | "realEstate" | "valuation"
}) {
  const accentClasses =
    accent === "business"
      ? {
          border: "border-[var(--color-success)]/35",
          title: "text-[var(--color-success)]",
          description: "text-[var(--color-text-secondary)]",
        }
      : accent === "realEstate"
        ? {
            border: "border-[var(--color-real-estate-accent)]/35",
            title: "text-[var(--color-real-estate-accent)]",
            description: "text-[var(--color-text-secondary)]",
          }
        : accent === "valuation"
        ? {
            border: "border-[var(--color-valuation-accent)]/35",
            title: "text-[var(--color-valuation-accent)]",
            description: "text-[var(--color-text-secondary)]",
          }
        : {
            border: "border-[var(--color-border)]",
            title: "text-[var(--color-text-primary)]",
            description: "text-muted-foreground",
          }

  return (
    <div className={`border-t pt-5 sm:pt-6 ${accentClasses.border}`}>
      <h3 className={`text-sm font-semibold ${accentClasses.title}`}>{title}</h3>
      {description ? (
        <p className={`mt-1 text-sm leading-5 ${accentClasses.description}`}>
          {description}
        </p>
      ) : null}
    </div>
  )
}

export function AccountForm({
  defaultValues,
  formId,
  isSaving,
  isCurrencyLocked,
  isOpeningBalanceLocked,
  mode,
  onSubmit,
  onDirtyChange,
}: AccountFormProps) {
  const { t } = useTranslation()
  const accountSchema = useMemo(() => createAccountSchema(t, mode), [mode, t])
  const {
    formState: { errors, isSubmitting, isSubmitted },
    handleSubmit,
    register,
    reset,
    control,
    setValue,
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
  useEffect(() => {
    onDirtyChange(
      hasMeaningfulAccountChanges(
        mergeWatchedAccountForm(values, defaultValues),
        defaultValues
      )
    )
  }, [defaultValues, onDirtyChange, values])

  const accountTypeCode = defaultValues.accountTypeCode
  const bankSubtype = values.bankSubtype ?? defaultValues.bankSubtype
  const isDisabled = isSaving || isSubmitting
  const showBalance = accountTypeCode !== "gold"
  const isValuedAccount =
    accountTypeCode === "real_estate" || accountTypeCode === "business"
  const valuationMethodOptions = isValuedAccount
    ? valuationMethodOptionsByAccountType[accountTypeCode]
    : []

  return (
    <form
      id={formId}
      className="space-y-3.5 sm:space-y-4"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      <input type="hidden" {...register("accountTypeCode")} />

      {accountTypeCode === "business" ? (
        <FormSectionHeading
          title={t("accounts.form.businessDetails")}
          accent="business"
        />
      ) : accountTypeCode === "real_estate" ? (
        <FormSectionHeading
          title={t("accounts.form.propertyDetails")}
          accent="realEstate"
        />
      ) : null}

      {accountTypeCode !== "gold" ? (
        <div>
          <label htmlFor={`${formId}-name`} className={labelClassName}>
            {t("accounts.form.name")}
          </label>
          <div className="relative">
            <UserRound
              aria-hidden="true"
              className="pointer-events-none absolute start-3.5 top-[calc(50%+3px)] size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              id={`${formId}-name`}
              className={`${fieldClassName} ps-10`}
              disabled={isDisabled}
              autoComplete="off"
              placeholder={t("accounts.form.namePlaceholder")}
              {...register("name")}
            />
          </div>
          {showError("name") ? (
            <p className={errorClassName}>{errors.name?.message}</p>
          ) : null}
        </div>
      ) : (
        <input type="hidden" {...register("name")} />
      )}

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
                  (option) => option.value === defaultValues.currencyCode
                )?.labelKey ?? "accounts.form.currency"
              )}
            </div>
            <p className="mt-1.5 text-xs text-[var(--color-text-secondary)]">
              {t("accounts.form.currencyLocked")}
            </p>
          </>
        ) : (
          <div className="relative">
            <Landmark
              aria-hidden="true"
              className="pointer-events-none absolute start-3.5 top-[calc(50%+3px)] size-4 -translate-y-1/2 text-muted-foreground"
            />
            <select
              id={`${formId}-currency`}
              className={`${fieldClassName} ps-10`}
              disabled={isDisabled}
              {...register("currencyCode")}
            >
              {currencyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </div>
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
          {showError("bankSubtype") ? (
            <p className={errorClassName}>{errors.bankSubtype?.message}</p>
          ) : null}
        </div>
      ) : null}

      {accountTypeCode === "bank" && bankSubtype === "credit" ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor={`${formId}-credit-card-limit`}
              className={labelClassName}
            >
              {t("accounts.form.creditCardLimit")}
            </label>
            <input
              id={`${formId}-credit-card-limit`}
              className={fieldClassName}
              disabled={
                isDisabled || (mode === "edit" && isOpeningBalanceLocked)
              }
              inputMode="decimal"
              dir="ltr"
              placeholder="0.00"
              {...register("creditCardLimit")}
            />
            {showError("creditCardLimit") ? (
              <p className={errorClassName}>
                {errors.creditCardLimit?.message}
              </p>
            ) : null}
          </div>
          <div>
            <label
              htmlFor={`${formId}-due-day-of-month`}
              className={labelClassName}
            >
              {t("accounts.form.dueDayOfMonth")}
            </label>
            <select
              id={`${formId}-due-day-of-month`}
              className={fieldClassName}
              disabled={isDisabled}
              {...register("dueDayOfMonth")}
            >
              <option value="">{t("accounts.form.dueDayUnset")}</option>
              {dueDayOfMonthOptions.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
            {showError("dueDayOfMonth") ? (
              <p className={errorClassName}>{errors.dueDayOfMonth?.message}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {accountTypeCode === "brokerage" ? (
        <div>
          <label
            htmlFor={`${formId}-investment-type`}
            className={labelClassName}
          >
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
          {showError("investmentType") ? (
            <p className={errorClassName}>{errors.investmentType?.message}</p>
          ) : null}
        </div>
      ) : null}

      {accountTypeCode === "real_estate" ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor={`${formId}-property-type`}
              className={labelClassName}
            >
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
            {showError("propertyType") ? (
              <p className={errorClassName}>{errors.propertyType?.message}</p>
            ) : null}
          </div>
          <div>
            <label htmlFor={`${formId}-location`} className={labelClassName}>
              {t("accounts.form.location")}{" "}
              <span className="font-normal text-muted-foreground">
                ({t("common.optional")})
              </span>
            </label>
            <input
              id={`${formId}-location`}
              className={fieldClassName}
              disabled={isDisabled}
              {...register("location")}
            />
          </div>
        </div>
      ) : null}

      {accountTypeCode === "business" ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor={`${formId}-business-type`}
              className={labelClassName}
            >
              {t("accounts.form.businessType")}
            </label>
            <select
              id={`${formId}-business-type`}
              className={fieldClassName}
              disabled={isDisabled}
              {...register("businessType")}
              onChange={(event) => {
                register("businessType").onChange(event)
                if (event.target.value !== "other")
                  setValue("businessTypeOther", "")
              }}
            >
              <option value="">{t("accounts.form.selectPlaceholder")}</option>
              {businessTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
            {showError("businessType") ? (
              <p className={errorClassName}>{errors.businessType?.message}</p>
            ) : null}
            {values.businessType === "other" ? (
              <>
                <label
                  htmlFor={`${formId}-business-type-other`}
                  className={`mt-3 block ${labelClassName}`}
                >
                  {t("accounts.form.businessTypeOther")}
                </label>
                <input
                  id={`${formId}-business-type-other`}
                  className={fieldClassName}
                  disabled={isDisabled}
                  autoComplete="off"
                  {...register("businessTypeOther")}
                />
                {showError("businessTypeOther") ? (
                  <p className={errorClassName}>
                    {errors.businessTypeOther?.message}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
          <div>
            <label htmlFor={`${formId}-industry`} className={labelClassName}>
              {t("accounts.form.industry")}
            </label>
            <Controller
              control={control}
              name="industry"
              render={({ field }) => (
                <BusinessIndustrySelector
                  id={`${formId}-industry`}
                  value={field.value}
                  options={industryOptions}
                  disabled={isDisabled}
                  onChange={(nextValue) => {
                    field.onChange(nextValue)
                    if (nextValue !== "other") setValue("industryOther", "")
                  }}
                />
              )}
            />
            {showError("industry") ? (
              <p className={errorClassName}>{errors.industry?.message}</p>
            ) : null}
            {values.industry === "other" ? (
              <>
                <label
                  htmlFor={`${formId}-industry-other`}
                  className={`mt-3 block ${labelClassName}`}
                >
                  {t("accounts.form.industryOther")}
                </label>
                <input
                  id={`${formId}-industry-other`}
                  className={fieldClassName}
                  disabled={isDisabled}
                  autoComplete="off"
                  {...register("industryOther")}
                />
                {showError("industryOther") ? (
                  <p className={errorClassName}>
                    {errors.industryOther?.message}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {accountTypeCode === "real_estate" || accountTypeCode === "business" ? (
        <div>
          <label htmlFor={`${formId}-ownership`} className={labelClassName}>
            {t("accounts.form.ownershipPercentage")}
          </label>
          <div className="relative mt-1.5" dir="ltr">
            <input
              id={`${formId}-ownership`}
              className={`${fieldClassName} mt-0 pe-10`}
              disabled={
                isDisabled || (mode === "edit" && isOpeningBalanceLocked)
              }
              inputMode="decimal"
              dir="ltr"
              placeholder="100"
              {...register("ownershipPercentage")}
            />
            <span
              className="pointer-events-none absolute inset-y-0 end-3.5 flex items-center text-sm text-muted-foreground"
              dir="ltr"
            >
              %
            </span>
          </div>
          {showError("ownershipPercentage") ? (
            <p className={errorClassName}>
              {errors.ownershipPercentage?.message}
            </p>
          ) : null}
        </div>
      ) : null}

      {accountTypeCode === "gold" ? (
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
          {showError("metalType") ? (
            <p className={errorClassName}>{errors.metalType?.message}</p>
          ) : null}
        </div>
      ) : null}

      {showBalance && !isValuedAccount ? (
        <div>
          <label
            htmlFor={`${formId}-opening-balance`}
            className={labelClassName}
          >
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
          {showError("openingBalance") ? (
            <p className={errorClassName}>{errors.openingBalance?.message}</p>
          ) : null}
        </div>
      ) : null}

      {isValuedAccount && mode === "create" ? (
        <>
          <FormSectionHeading
            title={t("accounts.form.initialValuation")}
            description={t(
              accountTypeCode === "business"
                ? "accounts.form.initialValuationDescription"
                : "accounts.form.initialPropertyValuationDescription"
            )}
            accent="valuation"
          />
          <div>
            <label
              htmlFor={`${formId}-valuation-amount`}
              className={labelClassName}
            >
              {t(getBalanceLabelKey(accountTypeCode))}
            </label>
            <input
              id={`${formId}-valuation-amount`}
              className={fieldClassName}
              disabled={isDisabled}
              inputMode="decimal"
              dir="ltr"
              placeholder="0.00"
              {...register("openingBalance")}
            />
            {showError("openingBalance") ? (
              <p className={errorClassName}>{errors.openingBalance?.message}</p>
            ) : null}
          </div>
          <div>
            <label
              htmlFor={`${formId}-valuation-date`}
              className={labelClassName}
            >
              {t("accounts.form.valuationDate")}
            </label>
            <input
              id={`${formId}-valuation-date`}
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              className={fieldClassName}
              disabled={isDisabled}
              {...register("valuationDate")}
            />
            {showError("valuationDate") ? (
              <p className={errorClassName}>{errors.valuationDate?.message}</p>
            ) : null}
          </div>
          {isValuedAccount ? (
            <div>
              <label
                htmlFor={`${formId}-valuation-method`}
                className={labelClassName}
              >
                {t("accounts.form.valuationMethod")}{" "}
                <span className="font-normal text-muted-foreground">
                  ({t("common.optional")})
                </span>
              </label>
              <select
                id={`${formId}-valuation-method`}
                className={fieldClassName}
                disabled={isDisabled}
                {...register("valuationMethod")}
                onChange={(event) => {
                  register("valuationMethod").onChange(event)
                  if (event.target.value !== "other")
                    setValue("valuationMethodOther", "")
                }}
              >
                <option value="">{t("accounts.form.selectPlaceholder")}</option>
                {valuationMethodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
              {values.valuationMethod === "other" ? (
                <>
                  <label
                    htmlFor={`${formId}-valuation-method-other`}
                    className={`mt-3 block ${labelClassName}`}
                  >
                    {t("accounts.form.valuationMethodOther")}
                  </label>
                  <input
                    id={`${formId}-valuation-method-other`}
                    className={fieldClassName}
                    disabled={isDisabled}
                    autoComplete="off"
                    {...register("valuationMethodOther")}
                  />
                  {showError("valuationMethodOther") ? (
                    <p className={errorClassName}>
                      {errors.valuationMethodOther?.message}
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}
          <div>
            <label
              htmlFor={`${formId}-valuation-notes`}
              className={labelClassName}
            >
              {t("accounts.form.valuationNotes")}{" "}
              <span className="font-normal text-muted-foreground">
                ({t("common.optional")})
              </span>
            </label>
            <textarea
              id={`${formId}-valuation-notes`}
              className={`${fieldClassName} min-h-20 resize-y`}
              disabled={isDisabled}
              {...register("valuationNotes")}
            />
          </div>
        </>
      ) : null}

      {accountTypeCode !== "gold" ? (
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

      <input type="hidden" {...register("isActive")} />
    </form>
  )
}
