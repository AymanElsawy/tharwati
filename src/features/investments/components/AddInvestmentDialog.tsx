import { zodResolver } from "@hookform/resolvers/zod"
import { AlertCircle, Plus, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useForm, useWatch } from "react-hook-form"

import { useTranslation } from "../../../i18n/useTranslation"
import type { TranslationKey } from "../../../i18n/en/translations"
import type {
  AccountSummary,
  AssetSummary,
} from "../../../lib/supabase/types"
import { accountsRepository } from "../../accounts/repositories/accounts.repository"
import {
  accountTypeOptions,
  currencyOptions,
} from "../../accounts/types/account-form"
import { assetsRepository } from "../../assets/repositories/assets.repository"
import { useAddInvestment } from "../hooks/useAddInvestment"
import { createAddInvestmentSchema } from "../schemas/add-investment.schema"
import {
  defaultAddInvestmentValues,
  type AddInvestmentResult,
  type AddInvestmentValues,
} from "../types/add-investment"

type Props = {
  isOpen: boolean
  onClose: () => void
  onSuccess: (result: AddInvestmentResult) => void
}

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] disabled:opacity-60"

const investmentAssetCategories = [
  "stock",
  "etf",
  "bond",
  "gold",
  "silver",
  "cryptocurrency",
  "real_estate",
  "business",
  "other",
] as const

function unitForAssetType(type: string): string {
  if (["stock", "etf", "mutual_fund", "bond"].includes(type)) {
    return "shares"
  }
  if (type === "cryptocurrency") return "coins"
  if (type === "gold" || type === "silver") return "troy_ounces"
  if (type === "real_estate") return "property"
  if (type === "business") return "ownership_units"
  if (type === "cash_equivalent") return "currency_amount"
  return "units"
}

export function AddInvestmentDialog({
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const { t } = useTranslation()
  const schema = useMemo(() => createAddInvestmentSchema(t), [t])
  const [accounts, setAccounts] = useState<AccountSummary[]>([])
  const [assets, setAssets] = useState<AssetSummary[]>([])
  const [isLoadingOptions, setIsLoadingOptions] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const { clearError, error, isSaving, submit } = useAddInvestment()
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setValue,
  } = useForm<AddInvestmentValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultAddInvestmentValues,
  })
  const [
    accountMode,
    assetMode,
    newAssetType,
    unit,
  ] = useWatch({
    control,
    name: [
      "accountMode",
      "assetMode",
      "newAssetTypeCode",
      "unit",
    ],
  })

  const isPreciousMetal =
    newAssetType === "gold" || newAssetType === "silver"

  useEffect(() => {
    if (!isOpen) return
    async function loadOptions() {
      setIsLoadingOptions(true)
      setLoadError(null)
      try {
        const [nextAccounts, nextAssets] = await Promise.all([
          accountsRepository.getAccounts(),
          assetsRepository.searchAssets("", 100),
        ])
        setAccounts(nextAccounts.filter((account) => account.is_active))
        setAssets(nextAssets)
      } catch (cause) {
        setLoadError(
          cause instanceof Error
            ? cause.message
            : t("investment.error.loadOptions"),
        )
      } finally {
        setIsLoadingOptions(false)
      }
    }
    void loadOptions()
  }, [isOpen, t])

  useEffect(() => {
    if (assetMode === "new") {
      setValue("unit", unitForAssetType(newAssetType))
    }
  }, [assetMode, newAssetType, setValue])

  if (!isOpen) return null

  async function save(values: AddInvestmentValues) {
    try {
      const result = await submit(values)
      if (result) {
        reset(defaultAddInvestmentValues)
        onSuccess(result)
        onClose()
      }
    } catch {
      // The typed error remains visible while entered form data is preserved.
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-investment-title"
        className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-[var(--color-background)] shadow-2xl"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-background)] px-6 py-5">
          <div>
            <h2 id="add-investment-title" className="text-2xl font-bold">
              {t("investment.title")}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {t("investment.description")}
            </p>
          </div>
          <button
            type="button"
            aria-label={t("investment.close")}
            disabled={isSaving}
            onClick={onClose}
            className="rounded-xl p-2"
          >
            <X size={20} />
          </button>
        </header>

        <form
          id="add-investment-form"
          className="space-y-7 p-6"
          onSubmit={handleSubmit(save)}
          noValidate
        >
          {(error || loadError) && (
            <div
              role="alert"
              className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              <AlertCircle size={18} className="shrink-0" />
              <span>{error?.message ?? loadError}</span>
            </div>
          )}

          <fieldset className="rounded-2xl border border-[var(--color-border)] p-5">
            <legend className="px-2 font-bold">
              {t("investment.account.section")}
            </legend>
            <div className="mb-4 flex gap-2">
              {(["existing", "new"] as const).map((mode) => (
                <label key={mode} className="flex items-center gap-2">
                  <input
                    type="radio"
                    value={mode}
                    disabled={isSaving}
                    {...register("accountMode")}
                  />
                  {t(
                    mode === "existing"
                      ? "investment.account.existing"
                      : "investment.account.new",
                  )}
                </label>
              ))}
            </div>
            {accountMode === "existing" ? (
              <label className="block text-sm font-semibold">
                {t("investment.account.select")}
                <select
                  className={fieldClass}
                  disabled={isSaving || isLoadingOptions}
                  {...register("accountId")}
                >
                  <option value="">{t("investment.common.choose")}</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} — {account.currency_code}
                    </option>
                  ))}
                </select>
                <span className="text-red-600">
                  {errors.accountId?.message}
                </span>
              </label>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold">
                  {t("investment.account.name")}
                  <input
                    className={fieldClass}
                    disabled={isSaving}
                    {...register("newAccountName")}
                  />
                  <span className="text-red-600">
                    {errors.newAccountName?.message}
                  </span>
                </label>
                <label className="text-sm font-semibold">
                  {t("investment.account.type")}
                  <select
                    className={fieldClass}
                    disabled={isSaving}
                    {...register("newAccountTypeCode")}
                  >
                    {accountTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  {t("investment.currency")}
                  <select
                    className={fieldClass}
                    disabled={isSaving}
                    {...register("newAccountCurrencyCode")}
                  >
                    {currencyOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  {t("investment.account.institution")}
                  <input
                    className={fieldClass}
                    disabled={isSaving}
                    {...register("newAccountInstitutionName")}
                  />
                </label>
              </div>
            )}
          </fieldset>

          <fieldset className="rounded-2xl border border-[var(--color-border)] p-5">
            <legend className="px-2 font-bold">
              {t("investment.asset.section")}
            </legend>
            <div className="mb-4 flex gap-2">
              {(["existing", "new"] as const).map((mode) => (
                <label key={mode} className="flex items-center gap-2">
                  <input
                    type="radio"
                    value={mode}
                    disabled={isSaving}
                    {...register("assetMode")}
                  />
                  {t(
                    mode === "existing"
                      ? "investment.asset.existing"
                      : "investment.asset.new",
                  )}
                </label>
              ))}
            </div>
            {assetMode === "existing" ? (
              <label className="block text-sm font-semibold">
                {t("investment.asset.select")}
                <select
                  className={fieldClass}
                  disabled={isSaving || isLoadingOptions}
                  {...register("assetId")}
                >
                  <option value="">{t("investment.common.choose")}</option>
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.symbol ? `${asset.symbol} — ` : ""}
                      {asset.name} ({asset.currency_code})
                    </option>
                  ))}
                </select>
                <span className="text-red-600">
                  {errors.assetId?.message}
                </span>
              </label>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold">
                  {t("investment.asset.type")}
                  <select
                    className={fieldClass}
                    disabled={isSaving}
                    {...register("newAssetTypeCode")}
                  >
                    {investmentAssetCategories.map((category) => (
                      <option key={category} value={category}>
                        {t(`investment.assetCategory.${category}`)}
                      </option>
                    ))}
                  </select>
                </label>
                {!isPreciousMetal ? (
                  <label className="text-sm font-semibold">
                    {t("investment.asset.name")}
                    <input
                      className={fieldClass}
                      disabled={isSaving}
                      {...register("newAssetName")}
                    />
                    <span className="text-red-600">
                      {errors.newAssetName?.message}
                    </span>
                  </label>
                ) : null}
                <label className="text-sm font-semibold">
                  {t("investment.currency")}
                  <select
                    className={fieldClass}
                    disabled={isSaving}
                    {...register("newAssetCurrencyCode")}
                  >
                    {currencyOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </option>
                    ))}
                  </select>
                </label>
                {!isPreciousMetal ? (
                  <>
                    <label className="text-sm font-semibold">
                      {t("investment.asset.symbol")}
                      <input
                        className={fieldClass}
                        dir="ltr"
                        disabled={isSaving}
                        {...register("newAssetSymbol")}
                      />
                      <span className="text-red-600">
                        {errors.newAssetSymbol?.message}
                      </span>
                    </label>
                    <label className="text-sm font-semibold">
                      {t("investment.asset.exchange")}
                      <input
                        className={fieldClass}
                        disabled={isSaving}
                        {...register("newAssetExchange")}
                      />
                    </label>
                  </>
                ) : null}
              </div>
            )}
          </fieldset>

          <fieldset className="rounded-2xl border border-[var(--color-border)] p-5">
            <legend className="px-2 font-bold">
              {t("investment.details.section")}
            </legend>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-sm font-semibold">
                {t("investment.transactionType")}
                <input
                  className={fieldClass}
                  value={t("investment.buy")}
                  disabled
                />
              </label>
              <label className="text-sm font-semibold">
                {t("investment.quantity")}
                <input
                  className={fieldClass}
                  dir="ltr"
                  inputMode="decimal"
                  disabled={isSaving}
                  {...register("quantity")}
                />
                <span className="text-red-600">
                  {errors.quantity?.message}
                </span>
              </label>
              <label className="text-sm font-semibold">
                {t("investment.unit")}
                <input
                  className={fieldClass}
                  value={t(
                    `investment.unit.${unit}` as TranslationKey,
                  )}
                  disabled
                />
              </label>
              <label className="text-sm font-semibold">
                {t("investment.unitPrice")}
                <input
                  className={fieldClass}
                  dir="ltr"
                  inputMode="decimal"
                  disabled={isSaving}
                  {...register("unitPrice")}
                />
                <span className="text-red-600">
                  {errors.unitPrice?.message}
                </span>
              </label>
              <label className="text-sm font-semibold">
                {t("investment.fees")}
                <input
                  className={fieldClass}
                  dir="ltr"
                  inputMode="decimal"
                  disabled={isSaving}
                  {...register("fees")}
                />
              </label>
              <label className="text-sm font-semibold">
                {t("investment.date")}
                <input
                  type="date"
                  className={fieldClass}
                  dir="ltr"
                  disabled={isSaving}
                  {...register("occurredAt")}
                />
              </label>
            </div>
            <label className="mt-4 block text-sm font-semibold">
              {t("investment.notes")}
              <textarea
                className={`${fieldClass} min-h-20`}
                disabled={isSaving}
                {...register("notes")}
              />
            </label>
          </fieldset>
        </form>

        <footer className="sticky bottom-0 flex justify-end gap-3 border-t border-[var(--color-border)] bg-[var(--color-background)] px-6 py-4">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => {
              clearError()
              onClose()
            }}
            className="tharwati-button-secondary"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            form="add-investment-form"
            disabled={isSaving || isLoadingOptions}
            className="tharwati-button-primary flex items-center gap-2 disabled:opacity-60"
          >
            <Plus size={18} />
            {isSaving
              ? t("investment.saving")
              : t("investment.save")}
          </button>
        </footer>
      </section>
    </div>
  )
}
