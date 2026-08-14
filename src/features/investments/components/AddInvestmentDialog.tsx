import { zodResolver } from "@hookform/resolvers/zod"
import { AlertCircle, Plus, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useForm, useWatch } from "react-hook-form"

import { useTranslation } from "../../../i18n/useTranslation"
import type { TranslationKey } from "../../../i18n/en/translations"
import type { AccountSummary, AssetSummary } from "../../../lib/supabase/types"
import { accountsRepository } from "../../accounts/repositories/accounts.repository"
import {
  accountTypeOptions,
  currencyOptions,
} from "../../accounts/types/account-form"
import { assetsRepository } from "../../assets/repositories/assets.repository"
import { useAddInvestment } from "../hooks/useAddInvestment"
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges"
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog"
import { createAddInvestmentSchema } from "../schemas/add-investment.schema"
import { filterInvestmentAssetCatalog } from "../services/investment-asset-catalog"
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

export function AddInvestmentDialog({ isOpen, onClose, onSuccess }: Props) {
  const { t } = useTranslation()
  const schema = useMemo(() => createAddInvestmentSchema(t), [t])
  const [accounts, setAccounts] = useState<AccountSummary[]>([])
  const [assets, setAssets] = useState<AssetSummary[]>([])
  const [isLoadingOptions, setIsLoadingOptions] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [assetSearch, setAssetSearch] = useState("")
  const { clearError, error, isSaving, submit } = useAddInvestment()
  const {
    control,
    formState: { errors, isDirty },
    handleSubmit,
    register,
    reset,
    setValue,
  } = useForm<AddInvestmentValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultAddInvestmentValues,
  })
  const [fundingMode, accountMode, assetMode, assetId, newAssetType, unit] = useWatch({
    control,
    name: ["fundingMode", "accountMode", "assetMode", "assetId", "newAssetTypeCode", "unit"],
  })
  const fundingAccounts = useMemo(
    () => accounts.filter((account) => ["cash", "bank"].includes(account.account_type_code)),
    [accounts],
  )

  const filteredAssets = useMemo(
    () => filterInvestmentAssetCatalog(assets, assetSearch),
    [assetSearch, assets],
  )
  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === assetId) ?? null,
    [assetId, assets],
  )

  const isPreciousMetal = newAssetType === "gold" || newAssetType === "silver"
  const isListedEquity = newAssetType === "stock" || newAssetType === "etf"
  const requiresMarketSymbol = [
    "stock",
    "etf",
    "bond",
    "cryptocurrency",
  ].includes(newAssetType)
  const unsaved = useUnsavedChanges(isOpen && isDirty)
  const requestClose = () => unsaved.request(onClose)

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
            : t("investment.error.loadOptions")
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
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-background)] px-4 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
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
            onClick={requestClose}
            className="rounded-xl p-2"
          >
            <X size={20} />
          </button>
        </header>

        <form
          id="add-investment-form"
          className="space-y-6 p-4 sm:space-y-7 sm:p-6"
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

          <fieldset className="rounded-2xl border border-[var(--color-border)] p-4 sm:p-5">
            <legend className="px-2 font-bold">{t("investment.funding.section")}</legend>
            <div className="space-y-3">
              <label className="flex items-start gap-2">
                <input type="radio" value="external" disabled={isSaving} {...register("fundingMode")} />
                <span><strong className="block">{t("investment.funding.external")}</strong><span className="text-sm text-[var(--color-text-secondary)]">{t("investment.funding.externalDescription")}</span></span>
              </label>
              <label className="flex items-start gap-2">
                <input type="radio" value="cash_account" disabled={isSaving} {...register("fundingMode")} />
                <span><strong className="block">{t("investment.funding.cash")}</strong><span className="text-sm text-[var(--color-text-secondary)]">{t("investment.funding.cashDescription")}</span></span>
              </label>
              {fundingMode === "cash_account" ? (
                <label className="block text-sm font-semibold">
                  {t("investment.funding.account")}
                  <select className={fieldClass} disabled={isSaving || isLoadingOptions} {...register("fundingAccountId")}>
                    <option value="">{t("investment.common.choose")}</option>
                    {fundingAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} — {account.currency_code}</option>)}
                  </select>
                  <span className="text-red-600">{errors.fundingAccountId?.message}</span>
                </label>
              ) : null}
            </div>
          </fieldset>

          <fieldset className="rounded-2xl border border-[var(--color-border)] p-4 sm:p-5">
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
                      : "investment.account.new"
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
              </div>
            )}
          </fieldset>

          <fieldset className="rounded-2xl border border-[var(--color-border)] p-4 sm:p-5">
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
                      : "investment.asset.new"
                  )}
                </label>
              ))}
            </div>
            {assetMode === "existing" ? (
              <div className="space-y-3">
              <label className="block text-sm font-semibold">
                {t("investment.asset.searchLabel")}
                <input
                  type="search"
                  value={assetSearch}
                  onChange={(event) => setAssetSearch(event.target.value)}
                  placeholder={t("investment.asset.searchPlaceholder")}
                  autoComplete="off"
                  className={fieldClass}
                  disabled={isSaving || isLoadingOptions}
                />
              </label>
              <label className="block text-sm font-semibold">
                {t("investment.asset.select")}
                <select
                  className={fieldClass}
                  disabled={isSaving || isLoadingOptions}
                  {...register("assetId")}
                >
                  <option value="">{t("investment.common.choose")}</option>
                  {filteredAssets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.symbol ? `${asset.symbol} — ` : ""}
                      {asset.name} ({asset.currency_code})
                    </option>
                  ))}
                </select>
                <span className="text-red-600">{errors.assetId?.message}</span>
              </label>
              {selectedAsset ? (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {t("investment.asset.authoritativeSelection", {
                    symbol: selectedAsset.symbol ?? selectedAsset.name,
                    exchange: selectedAsset.exchange ?? "—",
                    currency: selectedAsset.currency_code,
                  })}
                </p>
              ) : null}
              {filteredAssets.length === 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] p-3">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {t("investment.asset.noResults")}
                  </p>
                  <button
                    type="button"
                    className="tharwati-button-secondary"
                    onClick={() =>
                      setValue("assetMode", "new", { shouldDirty: true })
                    }
                  >
                    {t("investment.asset.createCustom")}
                  </button>
                </div>
              ) : null}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <p className="text-sm text-[var(--color-text-secondary)] sm:col-span-2">
                  {t("investment.asset.customDescription")}
                </p>
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
                      {t(
                        requiresMarketSymbol
                          ? "investment.asset.symbolRequired"
                          : "investment.asset.symbol",
                      )}
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
                      {t(
                        isListedEquity
                          ? "investment.asset.exchangeOptional"
                          : "investment.asset.exchange",
                      )}
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

          <fieldset className="rounded-2xl border border-[var(--color-border)] p-4 sm:p-5">
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
                <span className="text-red-600">{errors.quantity?.message}</span>
              </label>
              <label className="text-sm font-semibold">
                {t("investment.unit")}
                <input
                  className={fieldClass}
                  value={t(`investment.unit.${unit}` as TranslationKey)}
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
              requestClose()
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
            {isSaving ? t("investment.saving") : t("investment.save")}
          </button>
        </footer>
      </section>
      <UnsavedChangesDialog
        open={unsaved.confirmationOpen}
        onKeepEditing={unsaved.keepEditing}
        onDiscard={unsaved.discard}
      />
    </div>
  )
}
