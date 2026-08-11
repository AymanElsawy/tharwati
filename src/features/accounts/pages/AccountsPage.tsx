import { AlertTriangle } from "lucide-react"
import { useMemo, useState } from "react"

import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog"
import { AccountActiveFilters } from "@/features/accounts/components/AccountActiveFilters"
import { AccountActivity } from "@/features/accounts/components/AccountActivity"
import { AccountDataQuality } from "@/features/accounts/components/AccountDataQuality"
import {
  AccountDetailPanel,
  AccountEvidencePanels,
} from "@/features/accounts/components/AccountDetailPanel"
import { AccountDetailErrorBoundary } from "@/features/accounts/components/AccountDetailErrorBoundary"
import { AccountEvidenceRelationships } from "@/features/accounts/components/AccountEvidenceRelationships"
import { AccountFilterBar } from "@/features/accounts/components/AccountFilterBar"
import { AccountFormDialog } from "@/features/accounts/components/AccountFormDialog"
import { AccountHealth } from "@/features/accounts/components/AccountHealth"
import { AccountInventory } from "@/features/accounts/components/AccountInventory"
import { AccountRelationshipsSummary } from "@/features/accounts/components/AccountRelationshipsSummary"
import { AccountTypeNavigator } from "@/features/accounts/components/AccountTypeNavigator"
import { AccountWorkspaceHeader } from "@/features/accounts/components/AccountWorkspaceHeader"
import {
  AccountWorkspaceEmpty,
  AccountWorkspaceError,
  AccountWorkspaceSkeleton,
} from "@/features/accounts/components/AccountWorkspaceStates"
import { ArchiveAccountDialog } from "@/features/accounts/components/ArchiveAccountDialog"
import { DeleteAccountDialog } from "@/features/accounts/components/DeleteAccountDialog"
import { useAccountsWorkspace } from "@/features/accounts/hooks/useAccountsWorkspace"
import {
  accountToFormValues,
  emptyAccountFormValues,
  type AccountFormValues,
} from "@/features/accounts/types/account-form"
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges"
import { useTranslation } from "@/i18n/useTranslation"
import type { AccountSummary } from "@/lib/supabase/types"

export function AccountsPage() {
  const { t } = useTranslation()
  const workspace = useAccountsWorkspace()
  const { snapshot } = workspace
  const [form, setForm] = useState<{
    mode: "create" | "edit"
    account: AccountSummary | null
  } | null>(null)
  const [confirm, setConfirm] = useState<{
    mode: "archive" | "delete"
    account: AccountSummary
  } | null>(null)
  const [formDirty, setFormDirty] = useState(false)
  const unsaved = useUnsavedChanges(formDirty)
  const defaults = useMemo<AccountFormValues>(
    () =>
      form?.account
        ? accountToFormValues(form.account)
        : emptyAccountFormValues,
    [form]
  )
  const closeForm = () =>
    unsaved.request(() => {
      setForm(null)
      setFormDirty(false)
    })
  if (workspace.isLoading && snapshot === null)
    return <AccountWorkspaceSkeleton />
  if (snapshot === null)
    return (
      <AccountWorkspaceError
        error={workspace.error ?? new Error(t("accounts.error.unexpected"))}
        onRetry={() => void workspace.refresh()}
      />
    )
  const eligibility = snapshot.deletionEligibility.find(
    (entry) => entry.accountId === workspace.selectedAccountId
  )
  const history = eligibility?.hasFinancialHistory ?? false
  const relationship = snapshot.analysis.relationships.find(
    (entry) => entry.id === workspace.selectedRelationship
  )
  const filtered = Boolean(
    workspace.accountType ||
    workspace.filters.search ||
    workspace.filters.currency ||
    workspace.filters.lifecycle !== "active"
  )
  const hasAnalytical = Boolean(
    workspace.selectedHealthFactor ||
    workspace.selectedIssue ||
    workspace.selectedRelationship
  )
  const holding =
    snapshot.holdingsEvidence.find(
      (item) => item.holdingId === workspace.selectedHoldingId
    ) ?? null
  const asset =
    snapshot.assetsEvidence.find(
      (item) => item.assetId === workspace.selectedAssetId
    ) ?? null
  const activityItem =
    snapshot.activity.find(
      (item) => item.transactionId === workspace.selectedActivityId
    ) ?? null
  const activityTypes = [
    ...new Set(snapshot.activity.map((item) => item.type)),
  ].sort()
  return (
    <div className="pb-12">
      <span role="status" aria-live="polite" className="sr-only">
        {workspace.announcement}
      </span>
      {workspace.error ? (
        <div
          role="alert"
          className="mb-5 flex flex-wrap items-center justify-between gap-3 border-y border-amber-600/35 py-3 text-sm text-amber-800 dark:text-amber-300"
        >
          <span className="inline-flex items-center gap-2">
            <AlertTriangle size={16} />
            {t("accounts.workspace.refreshFailed")}
          </span>
          <button
            onClick={() => void workspace.refresh()}
            className="font-semibold underline focus-visible:ring-2"
          >
            {t("accounts.actions.tryAgain")}
          </button>
        </div>
      ) : null}
      <div
        aria-busy={workspace.isRefreshing}
        className={`transition-opacity motion-reduce:transition-none ${workspace.isRefreshing ? "opacity-60" : "opacity-100"}`}
      >
        <AccountWorkspaceHeader
          snapshot={snapshot}
          isRefreshing={workspace.isRefreshing}
          onScopeChange={(scope) =>
            unsaved.request(() => workspace.setScope(scope))
          }
          onAdd={() => setForm({ mode: "create", account: null })}
        />
        <AccountTypeNavigator
          options={snapshot.accountTypes}
          selected={workspace.accountType}
          total={snapshot.accountCount}
          onSelect={workspace.setAccountType}
        />
        <AccountFilterBar
          filters={workspace.filters}
          currencies={snapshot.currencies}
          resultCount={workspace.items.length}
          onChange={workspace.updateFilter}
        />
        <AccountActiveFilters
          filters={workspace.filters}
          accountType={workspace.accountType}
          healthFactor={workspace.selectedHealthFactor}
          issue={workspace.selectedIssue}
          relationshipLabel={
            relationship
              ? relationship.kind === "account_type"
                ? relationship.label
                : t(`accounts.relationships.${relationship.kind}`)
              : null
          }
          onChange={workspace.updateFilter}
          onClearType={() => workspace.setAccountType(null)}
          onClearHealth={() => workspace.selectHealthFactor(null)}
          onClearIssue={() => workspace.selectIssue(null)}
          onClearRelationship={() => workspace.setSelectedRelationship(null)}
          onClear={() => {
            workspace.clearFilters()
            workspace.clearAnalyticalFilters()
          }}
        />
        {workspace.accountScopeId ? (
          <button
            onClick={() =>
              unsaved.request(() => workspace.openAccountWorkspace(null))
            }
            className="text-primary mt-4 text-sm font-semibold focus-visible:ring-2"
          >
            {t("accounts.detail.restoreAll")}
          </button>
        ) : null}
        {workspace.items.length ? (
          <AccountInventory
            items={workspace.items}
            selectedId={workspace.selectedAccountId}
            sort={workspace.filters.sort}
            direction={workspace.filters.direction}
            onSort={workspace.toggleSort}
            onSelect={workspace.selectAccount}
          />
        ) : (
          <AccountWorkspaceEmpty
            filtered={filtered || hasAnalytical || snapshot.items.length > 0}
            onClear={() => {
              workspace.setAccountType(null)
              workspace.clearFilters()
              workspace.clearAnalyticalFilters()
            }}
          />
        )}
        <AccountHealth
          analysis={snapshot.analysis}
          selected={workspace.selectedHealthFactor}
          onSelect={workspace.selectHealthFactor}
        />
        <AccountDataQuality
          analysis={snapshot.analysis}
          items={snapshot.items}
          selected={workspace.selectedIssue}
          onSelect={workspace.selectIssue}
        />
        <AccountRelationshipsSummary
          analysis={snapshot.analysis}
          selected={workspace.selectedRelationship}
          onSelect={workspace.setSelectedRelationship}
        />
        <AccountEvidenceRelationships detail={workspace.detail} />
        <AccountActivity
          activity={workspace.activity}
          filters={workspace.activityFilters}
          types={activityTypes}
          error={snapshot.activityError}
          onFilter={workspace.setActivityFilters}
          onOpen={workspace.setSelectedActivityId}
        />
      </div>
      <AccountDetailErrorBoundary
        resetKey={`${snapshot.updatedAt}:${workspace.selectedAccountId ?? "none"}`}
        fallback={(detailError) => (
          <div
            role="alert"
            className="bg-background fixed bottom-4 end-4 z-[85] max-w-[calc(100vw-2rem)] rounded-xl border border-red-500/30 p-4 text-sm text-red-700 dark:text-red-300 sm:bottom-5 sm:end-5"
          >
            <strong className="block">
              {t("accounts.detail.renderError")}
            </strong>
            <span className="mt-1 block text-xs">{detailError.message}</span>
            <button
              type="button"
              className="mt-3 font-semibold underline"
              onClick={() => workspace.setDetailOpen(false)}
            >
              {t("common.close")}
            </button>
          </div>
        )}
      >
        <AccountDetailPanel
          detail={workspace.detail}
          open={workspace.detailOpen}
          canDelete={eligibility?.canDelete ?? false}
          onOpenChange={workspace.setDetailOpen}
          onScope={(id) =>
            unsaved.request(() => workspace.openAccountWorkspace(id))
          }
          onHolding={workspace.setSelectedHoldingId}
          onAsset={workspace.setSelectedAssetId}
          onActivity={workspace.setSelectedActivityId}
          onQuality={() => {
            workspace.setDetailOpen(false)
            document.getElementById("account-quality-title")?.focus()
          }}
          onEdit={() => {
            if (workspace.detail) {
              workspace.setDetailOpen(false)
              setForm({ mode: "edit", account: workspace.detail.item.account })
            }
          }}
          onArchive={() => {
            if (workspace.detail) {
              workspace.setDetailOpen(false)
              setConfirm({
                mode: "archive",
                account: workspace.detail.item.account,
              })
            }
          }}
          onDelete={() => {
            if (workspace.detail && eligibility?.canDelete) {
              workspace.setDetailOpen(false)
              setConfirm({
                mode: "delete",
                account: workspace.detail.item.account,
              })
            }
          }}
        />
      </AccountDetailErrorBoundary>
      <AccountEvidencePanels
        holding={holding}
        asset={asset}
        activity={activityItem}
        onCloseHolding={() => workspace.setSelectedHoldingId(null)}
        onCloseAsset={() => workspace.setSelectedAssetId(null)}
        onCloseActivity={() => workspace.setSelectedActivityId(null)}
      />
      {form ? (
        <AccountFormDialog
          defaultValues={defaults}
          isOpen
          isSaving={workspace.isSaving}
          isCurrencyLocked={form.mode === "edit" && history}
          isOpeningBalanceLocked={form.mode === "edit" && history}
          mode={form.mode}
          onDirtyChange={setFormDirty}
          onClose={closeForm}
          onSubmit={async (values) => {
            if (form.mode === "edit" && form.account)
              await workspace.updateAccount(form.account.id, values)
            else await workspace.createAccount(values)
            setFormDirty(false)
            setForm(null)
          }}
        />
      ) : null}
      <ArchiveAccountDialog
        account={confirm?.mode === "archive" ? confirm.account : null}
        isSaving={workspace.isSaving}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (confirm) {
            workspace.updateFilter("lifecycle", "all")
            await workspace.archiveAccount(confirm.account.id)
            setConfirm(null)
          }
        }}
      />
      <DeleteAccountDialog
        account={confirm?.mode === "delete" ? confirm.account : null}
        isSaving={workspace.isSaving}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (confirm) {
            await workspace.deleteAccount(confirm.account.id)
            setConfirm(null)
            requestAnimationFrame(() =>
              document.getElementById("account-inventory-title")?.focus()
            )
          }
        }}
      />
      <UnsavedChangesDialog
        open={unsaved.confirmationOpen}
        onKeepEditing={unsaved.keepEditing}
        onDiscard={unsaved.discard}
      />
      {workspace.mutationError ? (
        <div
          role="alert"
          className="bg-background fixed bottom-4 end-4 z-[80] max-w-[calc(100vw-2rem)] rounded-xl border border-red-500/30 p-4 text-sm text-red-700 dark:text-red-300 sm:bottom-5 sm:end-5"
        >
          <button
            className="float-end ms-4"
            onClick={workspace.clearMutationError}
            aria-label={t("common.dismiss")}
          >
            ×
          </button>
          {workspace.mutationError.message}
        </div>
      ) : null}
    </div>
  )
}
