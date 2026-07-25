import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"

import { useTranslation } from "../../../i18n/useTranslation"
import { createAccountSchema } from "../schemas/account.schema"
import {
  accountTypeOptions,
  currencyOptions,
  type AccountFormValues,
} from "../types/account-form"

type AccountFormProps = {
  defaultValues: AccountFormValues
  formId: string
  isSaving: boolean
  onSubmit: (values: AccountFormValues) => Promise<void>
}

const fieldClassName =
  "mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-soft)] disabled:cursor-not-allowed disabled:opacity-60"

export function AccountForm({
  defaultValues,
  formId,
  isSaving,
  onSubmit,
}: AccountFormProps) {
  const { t } = useTranslation()
  const accountSchema = useMemo(() => createAccountSchema(t), [t])
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues,
  })

  useEffect(() => {
    reset(defaultValues)
  }, [defaultValues, reset])

  const isDisabled = isSaving || isSubmitting

  return (
    <form
      id={formId}
      className="space-y-5"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      <div>
        <label
          htmlFor={`${formId}-name`}
          className="text-sm font-semibold text-[var(--color-text-primary)]"
        >
          {t("accounts.form.name")}
        </label>
        <input
          id={`${formId}-name`}
          className={fieldClassName}
          disabled={isDisabled}
          autoComplete="off"
          {...register("name")}
        />
        {errors.name ? (
          <p className="mt-1.5 text-sm text-red-600">{errors.name.message}</p>
        ) : null}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${formId}-type`}
            className="text-sm font-semibold text-[var(--color-text-primary)]"
          >
            {t("accounts.form.accountType")}
          </label>
          <select
            id={`${formId}-type`}
            className={fieldClassName}
            disabled={isDisabled}
            {...register("accountTypeCode")}
          >
            {accountTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor={`${formId}-currency`}
            className="text-sm font-semibold text-[var(--color-text-primary)]"
          >
            {t("accounts.form.currency")}
          </label>
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
        </div>
      </div>

      <div>
        <label
          htmlFor={`${formId}-institution`}
          className="text-sm font-semibold text-[var(--color-text-primary)]"
        >
          {t("accounts.form.institution")}
          <span className="ms-1 font-normal text-[var(--color-text-secondary)]">
            ({t("common.optional")})
          </span>
        </label>
        <input
          id={`${formId}-institution`}
          className={fieldClassName}
          disabled={isDisabled}
          autoComplete="organization"
          {...register("institutionName")}
        />
      </div>

      <div>
        <label
          htmlFor={`${formId}-opening-balance`}
          className="text-sm font-semibold text-[var(--color-text-primary)]"
        >
          {t("accounts.form.openingBalance")}
        </label>
        <input
          id={`${formId}-opening-balance`}
          className={fieldClassName}
          disabled={isDisabled}
          inputMode="decimal"
          dir="ltr"
          placeholder="0.00"
          {...register("openingBalance")}
        />
        {errors.openingBalance ? (
          <p className="mt-1.5 text-sm text-red-600">
            {errors.openingBalance.message}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor={`${formId}-notes`}
          className="text-sm font-semibold text-[var(--color-text-primary)]"
        >
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
