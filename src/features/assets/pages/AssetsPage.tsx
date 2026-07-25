import { AlertCircle, Box, Plus, RefreshCw, Search } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { useTranslation } from "../../../i18n/useTranslation"
import type { AssetSummary } from "../../../lib/supabase/types"
import { AssetTable } from "../components/AssetTable"
import { AssetConfirmDialog } from "../components/AssetConfirmDialog"
import { AssetFormDialog } from "../components/AssetFormDialog"
import { AssetToast } from "../components/AssetToast"
import { useAssets } from "../hooks/useAssets"
import {
  assetTypeOptions,
  assetToFormValues,
  currencyOptions,
  emptyAssetFormValues,
  type AssetFormValues,
} from "../types/asset-form"

type FormState =
  | { mode: "create"; asset: null }
  | { mode: "edit"; asset: AssetSummary }
  | null

export function AssetsPage() {
  const { t } = useTranslation()
  const {
    assets,
    error,
    isLoading,
    isSaving,
    canDeleteAsset,
    refreshAssets,
    createAsset,
    updateAsset,
    archiveAsset,
    deleteAsset,
    clearError,
  } = useAssets()
  const [form, setForm] = useState<FormState>(null)
  const [archiveTarget, setArchiveTarget] = useState<AssetSummary | null>(
    null,
  )
  const [deleteTarget, setDeleteTarget] = useState<AssetSummary | null>(
    null,
  )
  const [toast, setToast] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [assetType, setAssetType] = useState("")
  const [currency, setCurrency] = useState("")

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(id)
  }, [toast])

  const formValues = useMemo(
    () =>
      form?.mode === "edit"
        ? assetToFormValues(form.asset)
        : emptyAssetFormValues,
    [form],
  )
  const initialError = Boolean(error && assets.length === 0)
  const filteredAssets = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase()
    return assets.filter(
      (asset) =>
        (!normalizedSearch ||
          asset.name.toLocaleLowerCase().includes(normalizedSearch) ||
          asset.symbol?.toLocaleLowerCase().includes(normalizedSearch)) &&
        (!assetType || asset.asset_type_code === assetType) &&
        (!currency || asset.currency_code === currency),
    )
  }, [assetType, assets, currency, search])

  async function submit(values: AssetFormValues) {
    if (form?.mode === "edit") {
      await updateAsset(form.asset.id, values)
      setToast(t("assets.toast.updated"))
    } else {
      await createAsset(values)
      setToast(t("assets.toast.created"))
    }
  }

  return (
    <section className="mx-auto max-w-7xl">
      <header className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-3 text-[var(--color-primary)]">
            <Box size={26} />
            <span className="text-sm font-bold uppercase tracking-[0.18em]">
              {t("assets.page.eyebrow")}
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-black">
            {t("assets.page.title")}
          </h1>
          <p className="mt-2 text-[var(--color-text-secondary)]">
            {t("assets.page.description")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            clearError()
            setForm({ mode: "create", asset: null })
          }}
          className="tharwati-button-primary flex items-center gap-2"
        >
          <Plus size={18} />
          {t("assets.actions.create")}
        </button>
      </header>

      {error && !initialError ? (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-800"
        >
          <AlertCircle size={20} />
          <div className="flex-1">
            <p className="font-semibold">{t("assets.error.actionTitle")}</p>
            <p className="text-sm">{error.message}</p>
          </div>
          <button type="button" onClick={clearError} className="underline">
            {t("common.dismiss")}
          </button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="space-y-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-12 animate-pulse rounded-xl bg-[var(--color-surface-hover)]" />
          ))}
        </div>
      ) : null}

      {!isLoading && initialError ? (
        <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-red-200 bg-red-50 p-8 text-center">
          <AlertCircle size={34} className="text-red-600" />
          <h2 className="mt-4 text-xl font-bold text-red-900">
            {t("assets.error.loadTitle")}
          </h2>
          <p className="mt-2 text-sm text-red-700">{error?.message}</p>
          <button
            type="button"
            onClick={() => void refreshAssets()}
            className="mt-5 flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-white"
          >
            <RefreshCw size={16} />
            {t("assets.actions.tryAgain")}
          </button>
        </div>
      ) : null}

      {!isLoading && !initialError && assets.length === 0 ? (
        <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
          <Box size={40} className="text-[var(--color-primary)]" />
          <h2 className="mt-4 text-xl font-bold">
            {t("assets.empty.title")}
          </h2>
          <p className="mt-2 text-[var(--color-text-secondary)]">
            {t("assets.empty.description")}
          </p>
        </div>
      ) : null}

      {!isLoading && !initialError && assets.length > 0 ? (
        <div>
          <div className="mb-4 grid gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:grid-cols-[minmax(220px,1fr)_220px_180px]">
            <label className="relative">
              <Search
                size={17}
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]"
              />
              <span className="sr-only">{t("assets.filters.search")}</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("assets.filters.searchPlaceholder")}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] py-2.5 pe-3 ps-10 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </label>
            <label>
              <span className="sr-only">{t("assets.filters.type")}</span>
              <select
                value={assetType}
                onChange={(event) => setAssetType(event.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2.5 text-sm"
              >
                <option value="">{t("assets.filters.allTypes")}</option>
                {assetTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">{t("assets.filters.currency")}</span>
              <select
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2.5 text-sm"
              >
                <option value="">{t("assets.filters.allCurrencies")}</option>
                {currencyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {filteredAssets.length > 0 ? (
            <AssetTable
              assets={filteredAssets}
              canDeleteAsset={canDeleteAsset}
              onEdit={(target) =>
                setForm({ mode: "edit", asset: target })
              }
              onArchive={setArchiveTarget}
              onDelete={setDeleteTarget}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center text-[var(--color-text-secondary)]">
              {t("assets.filters.noResults")}
            </div>
          )}
        </div>
      ) : null}

      <AssetFormDialog
        defaultValues={formValues}
        isOpen={form !== null}
        isSaving={isSaving}
        mode={form?.mode ?? "create"}
        onClose={() => {
          if (!isSaving) setForm(null)
        }}
        onSubmit={submit}
      />
      <AssetConfirmDialog
        asset={archiveTarget}
        isSaving={isSaving}
        mode="archive"
        onCancel={() => setArchiveTarget(null)}
        onConfirm={async () => {
          if (!archiveTarget) return
          await archiveAsset(archiveTarget.id)
          setArchiveTarget(null)
          setToast(t("assets.toast.archived"))
        }}
      />
      <AssetConfirmDialog
        asset={deleteTarget}
        isSaving={isSaving}
        mode="delete"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return
          await deleteAsset(deleteTarget.id)
          setDeleteTarget(null)
          setToast(t("assets.toast.deleted"))
        }}
      />
      <AssetToast message={toast} onDismiss={() => setToast(null)} />
    </section>
  )
}
