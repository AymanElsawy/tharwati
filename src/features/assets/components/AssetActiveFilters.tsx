import { X } from "lucide-react"

import type { AssetWorkspaceFilters } from "@/features/assets/types/asset-workspace"
import type {
  AssetHealthFactorId,
  AssetQualityIssueId,
} from "@/features/assets/types/asset-workspace"
import { useTranslation } from "@/i18n/useTranslation"

type FilterUpdater = <Key extends keyof AssetWorkspaceFilters>(
  key: Key,
  value: AssetWorkspaceFilters[Key],
) => void

export function AssetActiveFilters({
  filters,
  onChange,
  onClear,
  selectedFactorId,
  selectedIssueId,
  onClearFactor,
  onClearIssue,
  selectedAssetName,
  onClearAsset,
  relationshipAccountFiltered,
  activityAccountFiltered,
  activityType,
  onClearRelationshipAccount,
  onClearActivityAccount,
  onClearActivityType,
}: {
  filters: AssetWorkspaceFilters
  onChange: FilterUpdater
  onClear: () => void
  selectedFactorId: AssetHealthFactorId | null
  selectedIssueId: AssetQualityIssueId | null
  onClearFactor: () => void
  onClearIssue: () => void
  selectedAssetName: string | null
  onClearAsset: () => void
  relationshipAccountFiltered: boolean
  activityAccountFiltered: boolean
  activityType: string | null
  onClearRelationshipAccount: () => void
  onClearActivityAccount: () => void
  onClearActivityType: () => void
}) {
  const { t } = useTranslation()
  const chips = [
    filters.ownership !== "all"
      ? { id: "ownership", label: t(`assets.workspace.ownership.${filters.ownership}`), clear: () => onChange("ownership", "all") }
      : null,
    filters.accountId
      ? { id: "account", label: t("assets.workspace.accountFiltered"), clear: () => onChange("accountId", null) }
      : null,
    filters.currency
      ? { id: "currency", label: filters.currency, clear: () => onChange("currency", null) }
      : null,
    filters.lifecycle !== "active"
      ? { id: "lifecycle", label: filters.lifecycle === "archived" ? t("assets.card.archived") : t("assets.workspace.allStatuses"), clear: () => onChange("lifecycle", "active") }
      : null,
    filters.origin !== "all"
      ? { id: "origin", label: filters.origin === "global" ? t("assets.card.global") : t("assets.card.custom"), clear: () => onChange("origin", "all") }
      : null,
  ].filter((chip): chip is NonNullable<typeof chip> => chip !== null)
  const analytical = [
    selectedAssetName
      ? { id: "asset", label: `${t("assets.workspace.assetFocus")}: ${selectedAssetName}`, clear: onClearAsset }
      : null,
    selectedFactorId
      ? {
          id: "health",
          label: `${t("assets.health.filterLabel")}: ${t(`assets.health.factor.${selectedFactorId}`)}`,
          clear: onClearFactor,
        }
      : null,
    selectedIssueId
      ? {
          id: "issue",
          label: `${t("assets.quality.filterLabel")}: ${t(`assets.quality.issue.${selectedIssueId}`)}`,
          clear: onClearIssue,
        }
      : null,
    relationshipAccountFiltered
      ? { id: "relationship-account", label: t("assets.relationships.accountFilterActive"), clear: onClearRelationshipAccount }
      : null,
    activityAccountFiltered
      ? { id: "activity-account", label: t("assets.activity.accountFilterActive"), clear: onClearActivityAccount }
      : null,
    activityType
      ? { id: "activity-type", label: `${t("assets.activity.filterType")}: ${activityType}`, clear: onClearActivityType }
      : null,
  ].filter((chip): chip is NonNullable<typeof chip> => chip !== null)
  if (chips.length === 0 && analytical.length === 0) return null
  return (
    <div aria-label={t("assets.workspace.activeFilters")} className="mt-3 flex flex-wrap items-center gap-2">
      {chips.map((chip) => <button key={chip.id} type="button" onClick={chip.clear} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium focus-visible:ring-2">{chip.label}<X size={12} aria-hidden="true" /></button>)}
      {analytical.map((chip) => <button key={chip.id} type="button" onClick={chip.clear} className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 px-3 py-1.5 text-xs font-medium text-primary focus-visible:ring-2">{chip.label}<X size={12} aria-hidden="true" /></button>)}
      {chips.length > 0 ? <button type="button" onClick={onClear} className="text-xs font-semibold text-primary underline-offset-4 hover:underline focus-visible:ring-2">{t("assets.workspace.clearFilters")}</button> : null}
    </div>
  )
}
