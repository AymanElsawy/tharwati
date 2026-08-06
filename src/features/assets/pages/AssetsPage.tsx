import { AlertTriangle } from "lucide-react"
import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

import { AssetActiveFilters } from "@/features/assets/components/AssetActiveFilters"
import { AssetClassNavigator } from "@/features/assets/components/AssetClassNavigator"
import { AssetFilterBar } from "@/features/assets/components/AssetFilterBar"
import { AssetInventory } from "@/features/assets/components/AssetInventory"
import { AssetHealth } from "@/features/assets/components/AssetHealth"
import { AssetDataQuality } from "@/features/assets/components/AssetDataQuality"
import { AssetRelationships } from "@/features/assets/components/AssetRelationships"
import { AssetRecentActivity } from "@/features/assets/components/AssetRecentActivity"
import {
  ActivityEvidencePanel,
  AssetDetailPanel,
  HoldingEvidencePanel,
} from "@/features/assets/components/AssetEvidencePanels"
import { AssetWorkspaceHeader } from "@/features/assets/components/AssetWorkspaceHeader"
import { AssetIntentDialog } from "@/features/assets/components/AssetIntentDialog"
import { AssetFormDialog } from "@/features/assets/components/AssetFormDialog"
import { AssetConfirmDialog } from "@/features/assets/components/AssetConfirmDialog"
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog"
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges"
import type { AssetFormValues } from "@/features/assets/types/asset-form"
import type { AssetSummary } from "@/lib/supabase/types"
import {
  AssetWorkspaceEmpty,
  AssetWorkspaceError,
  AssetWorkspaceSkeleton,
} from "@/features/assets/components/AssetWorkspaceStates"
import { useAssetsWorkspace } from "@/features/assets/hooks/useAssetsWorkspace"
import { useTranslation } from "@/i18n/useTranslation"
import { EditInvestmentDialog } from "@/features/investments/components/EditInvestmentDialog"

export function AssetsPage() {
  const {
    snapshot,
    items,
    assetClassId,
    filters,
    selectedAssetId,
    selectedHoldingId,
    selectedActivityId,
    selectedAssetDetail,
    isAssetDetailOpen,
    relationships,
    activity,
    evidenceFilters,
    analysis,
    selectedHealthFactorId,
    selectedIssueId,
    error,
    isLoading,
    isRefreshing,
    isSaving,
    mutationError,
    setScope,
    setAssetClassId,
    updateFilter,
    toggleSort,
    clearFilters,
    setSelectedAssetId,
    setSelectedHoldingId,
    setSelectedActivityId,
    setIsAssetDetailOpen,
    openAssetDetail,
    updateEvidenceFilter,
    selectHealthFactor,
    selectIssue,
    createAsset,
    updateAsset,
    archiveAsset,
    deleteAsset,
    clearMutationError,
    refresh,
  } = useAssetsWorkspace()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [intentOpen, setIntentOpen] = useState(false)
  const [form, setForm] = useState<{
    mode: "create" | "edit"
    asset: AssetSummary | null
  } | null>(null)
  const [confirm, setConfirm] = useState<{
    mode: "archive" | "delete"
    asset: AssetSummary
  } | null>(null)
  const [formDirty, setFormDirty] = useState(false)
  const [editInvestmentId, setEditInvestmentId] = useState<string | null>(null)
  const unsaved = useUnsavedChanges(formDirty)
  const defaults = useMemo<AssetFormValues>(
    () =>
      form?.asset
        ? {
            assetTypeCode: form.asset
              .asset_type_code as AssetFormValues["assetTypeCode"],
            name: form.asset.name,
            symbol: form.asset.symbol ?? "",
            currencyCode: form.asset
              .currency_code as AssetFormValues["currencyCode"],
            exchange: form.asset.exchange ?? "",
            isActive: form.asset.is_active,
          }
        : {
            assetTypeCode: "stock",
            name: "",
            symbol: "",
            currencyCode: "USD",
            exchange: "",
            isActive: true,
          },
    [form],
  )
  const closeForm = () =>
    unsaved.request(() => {
      setForm(null)
      setFormDirty(false)
    })

  if (isLoading && snapshot === null) return <AssetWorkspaceSkeleton />
  if (snapshot === null) {
    return (
      <AssetWorkspaceError
        error={error ?? new Error(t("assets.error.unexpected"))}
        onRetry={() => void refresh()}
      />
    )
  }

  const hasFilters =
    Boolean(
      filters.search || assetClassId || filters.accountId || filters.currency
    ) ||
    filters.ownership !== "all" ||
    filters.lifecycle !== "active" ||
    filters.origin !== "all"

  return (
    <div className="pb-12">
      {error ? (
        <div
          role="alert"
          className="mb-5 flex items-center justify-between gap-4 border-y border-amber-600/35 py-3 text-sm text-amber-800 dark:text-amber-300"
        >
          <span className="inline-flex items-center gap-2">
            <AlertTriangle size={16} />
            {t("assets.workspace.refreshFailed")}
          </span>
          <button
            type="button"
            onClick={() => void refresh()}
            className="font-semibold underline underline-offset-4 focus-visible:ring-2"
          >
            {t("assets.actions.tryAgain")}
          </button>
        </div>
      ) : null}
      <div
        aria-busy={isRefreshing}
        className={`transition-opacity duration-150 motion-reduce:transition-none ${isRefreshing ? "opacity-60" : "opacity-100"}`}
      >
        <span className="sr-only" role="status" aria-live="polite">
          {isRefreshing ? t("assets.workspace.updating") : ""}
        </span>
        <AssetWorkspaceHeader
          snapshot={snapshot}
          isRefreshing={isRefreshing}
          onScopeChange={(id) => unsaved.request(() => setScope(id))}
          onAdd={() => setIntentOpen(true)}
        />
        <AssetClassNavigator
          options={snapshot.assetClasses}
          selectedId={assetClassId}
          totalCount={snapshot.recordCount}
          onSelect={setAssetClassId}
        />
        <AssetFilterBar
          filters={filters}
          accounts={snapshot.scopeOptions}
          resultCount={items.length}
          onChange={updateFilter}
        />
        <AssetActiveFilters
          filters={filters}
          onChange={updateFilter}
          onClear={clearFilters}
          selectedFactorId={selectedHealthFactorId}
          selectedIssueId={selectedIssueId}
          onClearFactor={() => selectHealthFactor(null)}
          onClearIssue={() => selectIssue(null)}
          selectedAssetName={
            snapshot.items.find((item) => item.asset.id === selectedAssetId)
              ?.asset.name ?? null
          }
          onClearAsset={() => {
            setSelectedAssetId(null)
            setIsAssetDetailOpen(false)
          }}
          relationshipAccountFiltered={
            evidenceFilters.relationshipAccountId !== null
          }
          activityAccountFiltered={evidenceFilters.activityAccountId !== null}
          activityType={evidenceFilters.activityType}
          onClearRelationshipAccount={() =>
            updateEvidenceFilter("relationshipAccountId", null)
          }
          onClearActivityAccount={() =>
            updateEvidenceFilter("activityAccountId", null)
          }
          onClearActivityType={() => updateEvidenceFilter("activityType", null)}
        />
        {items.length > 0 ? (
          <AssetInventory
            items={items}
            selectedAssetId={selectedAssetId}
            sort={filters.sort}
            direction={filters.direction}
            onSort={toggleSort}
            onSelect={openAssetDetail}
            onManagePrice={(item) =>
              navigate(
                `/market-prices?assetId=${encodeURIComponent(item.asset.id)}`,
                { state: { returnTo: "/assets" } }
              )
            }
          />
        ) : (
          <div className="mt-10">
            <AssetWorkspaceEmpty
              filtered={hasFilters || snapshot.items.length > 0}
              onClear={() => {
                setAssetClassId(null)
                clearFilters()
                selectHealthFactor(null)
              }}
            />
          </div>
        )}
        <AssetHealth
          analysis={analysis}
          selectedFactorId={selectedHealthFactorId}
          onSelect={selectHealthFactor}
        />
        <AssetDataQuality
          analysis={analysis}
          items={snapshot.items}
          selectedIssueId={selectedIssueId}
          onSelect={selectIssue}
        />
        <AssetRelationships
          relationships={relationships}
          accounts={snapshot.scopeOptions}
          selectedAsset={selectedAssetId !== null}
          accountId={evidenceFilters.relationshipAccountId}
          onAccountFilter={(id) =>
            updateEvidenceFilter("relationshipAccountId", id)
          }
          onOpenHolding={setSelectedHoldingId}
        />
        <AssetRecentActivity
          activity={activity}
          error={snapshot.activityError}
          accountId={evidenceFilters.activityAccountId}
          activityType={evidenceFilters.activityType}
          accounts={snapshot.scopeOptions}
          types={[
            ...new Set(snapshot.activity.map((item) => item.type)),
          ].sort()}
          onAccountFilter={(id) =>
            updateEvidenceFilter("activityAccountId", id)
          }
          onTypeFilter={(type) => updateEvidenceFilter("activityType", type)}
          onOpen={setSelectedActivityId}
        />
      </div>
      <AssetDetailPanel
        detail={selectedAssetDetail}
        open={isAssetDetailOpen}
        onOpenChange={setIsAssetDetailOpen}
        onAccountScope={(id) => {
          setIsAssetDetailOpen(false)
          setScope(id)
        }}
        onOpenActivity={(id) => {
          setIsAssetDetailOpen(false)
          setSelectedActivityId(id)
        }}
        onEdit={() => {
          if (selectedAssetDetail?.item.origin === "custom") {
            setIsAssetDetailOpen(false)
            setForm({ mode: "edit", asset: selectedAssetDetail.item.asset })
          }
        }}
        onArchive={() => {
          if (selectedAssetDetail?.item.origin === "custom") {
            setIsAssetDetailOpen(false)
            setConfirm({
              mode: "archive",
              asset: selectedAssetDetail.item.asset,
            })
          }
        }}
        onDelete={() => {
          if (
            selectedAssetDetail?.item.origin === "custom" &&
            selectedAssetDetail.item.referenceCount === 0
          ) {
            setIsAssetDetailOpen(false)
            setConfirm({
              mode: "delete",
              asset: selectedAssetDetail.item.asset,
            })
          }
        }}
      />
      <HoldingEvidencePanel
        holding={
          snapshot.relationships.find(
            (item) => item.holdingId === selectedHoldingId
          ) ?? null
        }
        open={selectedHoldingId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedHoldingId(null)
        }}
      />
      <ActivityEvidencePanel
        activity={
          snapshot.activity.find((item) => item.id === selectedActivityId) ??
          null
        }
        open={selectedActivityId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedActivityId(null)
        }}
        onEditInvestment={(id) => {
          setSelectedActivityId(null)
          setEditInvestmentId(id)
        }}
      />
      <EditInvestmentDialog
        transactionId={editInvestmentId}
        open={editInvestmentId !== null}
        onClose={() => setEditInvestmentId(null)}
        onSuccess={() => {
          setEditInvestmentId(null)
          void refresh()
        }}
      />
      <AssetIntentDialog
        open={intentOpen}
        records={snapshot.items}
        scopeName={snapshot.activeScopeId ? snapshot.scopeOptions.find((scope) => scope.id === snapshot.activeScopeId)?.name ?? t("assets.workspace.allAssets") : t("assets.workspace.allAssets")}
        onClose={() => setIntentOpen(false)}
        onCreateRecord={() => {
          setIntentOpen(false)
          setForm({ mode: "create", asset: null })
        }}
        onRecordInvestment={() => {
          setIntentOpen(false)
          window.dispatchEvent(new CustomEvent("tharwati:add-investment"))
        }}
        onSelectExisting={(id) => {
          setIntentOpen(false)
          openAssetDetail(id)
        }}
      />
      <AssetFormDialog
        defaultValues={defaults}
        isOpen={form !== null}
        isSaving={isSaving}
        mode={form?.mode ?? "create"}
        onDirtyChange={setFormDirty}
        onClose={closeForm}
        onSubmit={async (values) => {
          const saved =
            form?.mode === "edit" && form.asset
              ? await updateAsset(form.asset.id, values)
              : await createAsset(values)
          setFormDirty(false)
          setForm(null)
          setSelectedAssetId(saved.id)
        }}
      />
      <AssetConfirmDialog
        asset={confirm?.asset ?? null}
        isSaving={isSaving}
        mode={confirm?.mode ?? "archive"}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (!confirm) return
          if (confirm.mode === "archive") {
            updateFilter("lifecycle", "all")
            await archiveAsset(confirm.asset.id)
          } else {
            await deleteAsset(confirm.asset.id)
            requestAnimationFrame(() =>
              document.getElementById("asset-inventory-title")?.focus()
            )
          }
          setConfirm(null)
        }}
      />
      <UnsavedChangesDialog
        open={unsaved.confirmationOpen}
        onKeepEditing={unsaved.keepEditing}
        onDiscard={unsaved.discard}
      />
      {mutationError ? (
        <div
          role="alert"
          aria-live="assertive"
          className="bg-background fixed end-5 bottom-5 z-[80] max-w-sm rounded-xl border border-red-500/30 p-4 text-sm text-red-700 dark:text-red-300"
        >
          <button
            type="button"
            className="float-end ms-4"
            onClick={clearMutationError}
            aria-label={t("common.dismiss")}
          >
            ×
          </button>
          {mutationError.message}
        </div>
      ) : null}
    </div>
  )
}
