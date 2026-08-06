import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useMemo } from "react"
import { useForm, useWatch } from "react-hook-form"

import { useTranslation } from "../../../i18n/useTranslation"
import { createAssetSchema } from "../schemas/asset.schema"
import {
  assetTypeOptions,
  currencyOptions,
  type AssetFormValues,
} from "../types/asset-form"
import { hasMeaningfulAssetChanges } from "../utils/asset-form-state"

type Props = {
  defaultValues: AssetFormValues
  formId: string
  isSaving: boolean
  onSubmit: (values: AssetFormValues) => Promise<void>
  onDirtyChange?: (dirty: boolean) => void
}

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-soft)] disabled:cursor-not-allowed disabled:opacity-60"

export function AssetForm({
  defaultValues,
  formId,
  isSaving,
  onSubmit,
  onDirtyChange,
}: Props) {
  const { t } = useTranslation()
  const schema = useMemo(() => createAssetSchema(t), [t])
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    control,
  } = useForm<AssetFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  useEffect(() => reset(defaultValues), [defaultValues, reset])
  const watched = useWatch({ control })
  useEffect(() => {
    onDirtyChange?.(
      hasMeaningfulAssetChanges(
        { ...defaultValues, ...watched } as AssetFormValues,
        defaultValues,
      ),
    )
  }, [defaultValues, onDirtyChange, watched])
  const disabled = isSaving || isSubmitting

  return (
    <form
      id={formId}
      className="space-y-5"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${formId}-type`} className="text-sm font-semibold">
            {t("assets.form.assetType")}
          </label>
          <select
            id={`${formId}-type`}
            className={fieldClass}
            disabled={disabled}
            {...register("assetTypeCode")}
          >
            {assetTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor={`${formId}-currency`}
            className="text-sm font-semibold"
          >
            {t("assets.form.currency")}
          </label>
          <select
            id={`${formId}-currency`}
            className={fieldClass}
            disabled={disabled}
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
        <label htmlFor={`${formId}-name`} className="text-sm font-semibold">
          {t("assets.form.name")}
        </label>
        <input
          id={`${formId}-name`}
          className={fieldClass}
          disabled={disabled}
          {...register("name")}
        />
        {errors.name ? (
          <p className="mt-1.5 text-sm text-red-600">
            {errors.name.message}
          </p>
        ) : null}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${formId}-symbol`}
            className="text-sm font-semibold"
          >
            {t("assets.form.symbol")} ({t("common.optional")})
          </label>
          <input
            id={`${formId}-symbol`}
            className={fieldClass}
            disabled={disabled}
            dir="ltr"
            {...register("symbol")}
          />
          {errors.symbol ? (
            <p className="mt-1.5 text-sm text-red-600">
              {errors.symbol.message}
            </p>
          ) : null}
        </div>
        <div>
          <label
            htmlFor={`${formId}-exchange`}
            className="text-sm font-semibold"
          >
            {t("assets.form.exchange")} ({t("common.optional")})
          </label>
          <input
            id={`${formId}-exchange`}
            className={fieldClass}
            disabled={disabled}
            {...register("exchange")}
          />
          {errors.exchange ? (
            <p className="mt-1.5 text-sm text-red-600">
              {errors.exchange.message}
            </p>
          ) : null}
        </div>
      </div>
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
        <input
          type="checkbox"
          className="size-4 accent-[var(--color-primary)]"
          disabled={disabled}
          {...register("isActive")}
        />
        <span>
          <span className="block text-sm font-semibold">
            {t("assets.form.active")}
          </span>
          <span className="block text-xs text-[var(--color-text-secondary)]">
            {t("assets.form.activeDescription")}
          </span>
        </span>
      </label>
    </form>
  )
}
