import { X } from "lucide-react"
import type { AccountHealthFactorId, AccountQualityIssueId, AccountWorkspaceFilters } from "@/features/accounts/types/account-workspace"
import { useTranslation } from "@/i18n/useTranslation"

type Update = <Key extends keyof AccountWorkspaceFilters>(key: Key, value: AccountWorkspaceFilters[Key]) => void
export function AccountActiveFilters({ filters, accountType, healthFactor, issue, relationshipLabel, onChange, onClearType, onClearHealth, onClearIssue, onClearRelationship, onClear }: { filters: AccountWorkspaceFilters; accountType: string | null; healthFactor: AccountHealthFactorId | null; issue: AccountQualityIssueId | null; relationshipLabel: string | null; onChange: Update; onClearType: () => void; onClearHealth: () => void; onClearIssue: () => void; onClearRelationship: () => void; onClear: () => void }) {
  const { t } = useTranslation()
  const chips = [accountType ? { id: "type", label: accountType, clear: onClearType } : null, filters.currency ? { id: "currency", label: filters.currency, clear: () => onChange("currency", null) } : null, filters.lifecycle !== "active" ? { id: "status", label: filters.lifecycle, clear: () => onChange("lifecycle", "active") } : null, healthFactor ? { id: "health", label: t(`accounts.health.factor.${healthFactor}`), clear: onClearHealth } : null, issue ? { id: "issue", label: t(`accounts.quality.issue.${issue}`), clear: onClearIssue } : null, relationshipLabel ? { id: "relationship", label: relationshipLabel, clear: onClearRelationship } : null].filter((item): item is NonNullable<typeof item> => item !== null)
  if (!chips.length) return null
  return <div aria-label={t("accounts.workspace.activeFilters")} className="mt-3 flex flex-wrap items-center gap-2">{chips.map((chip) => <button key={chip.id} type="button" onClick={chip.clear} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs focus-visible:ring-2">{chip.label}<X size={12} /></button>)}<button type="button" onClick={onClear} className="text-xs font-semibold text-primary hover:underline focus-visible:ring-2">{t("assets.workspace.clearFilters")}</button></div>
}
