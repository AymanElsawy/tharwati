import { Search, SlidersHorizontal, X } from "lucide-react"

import type {
  AssetOrigin,
  AssetWorkspaceFilters,
} from "@/features/assets/types/asset-workspace"
import type { AssetAccountReference } from "@/features/assets/types/asset-workspace"
import { currencyOptions } from "@/features/assets/types/asset-form"
import { useTranslation } from "@/i18n/useTranslation"

type FilterUpdater = <Key extends keyof AssetWorkspaceFilters>(
  key: Key,
  value: AssetWorkspaceFilters[Key],
) => void

export function AssetFilterBar({
  filters,
  accounts,
  resultCount,
  onChange,
}: {
  filters: AssetWorkspaceFilters
  accounts: AssetAccountReference[]
  resultCount: number
  onChange: FilterUpdater
}) {
  const { t } = useTranslation()
  return (
    <div className="mt-6">
      <div className="grid gap-3 md:grid-cols-[minmax(14rem,1fr)_repeat(4,minmax(9rem,auto))]">
        <label className="relative">
          <span className="sr-only">{t("assets.filters.search")}</span>
          <Search size={16} className="pointer-events-none absolute start-3 top-3 text-muted-foreground" />
          <input type="search" value={filters.search} onChange={(event) => onChange("search", event.target.value)} placeholder={t("assets.filters.searchPlaceholder")} className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-background ps-9 pe-9 text-sm outline-none focus-visible:ring-2" />
          {filters.search ? <button type="button" onClick={() => onChange("search", "")} aria-label={t("assets.workspace.clearSearch")} className="absolute end-2 top-2 rounded p-1 focus-visible:ring-2"><X size={14} /></button> : null}
        </label>
        <select aria-label={t("assets.workspace.filterOwnership")} value={filters.ownership} onChange={(event) => onChange("ownership", event.target.value as AssetWorkspaceFilters["ownership"])} className="h-10 rounded-xl border border-[var(--color-border)] bg-background px-3 text-sm">
          <option value="all">{t("assets.workspace.ownershipAll")}</option>
          <option value="owned">{t("assets.workspace.ownership.owned")}</option>
          <option value="record_only">{t("assets.workspace.ownership.record_only")}</option>
        </select>
        <select aria-label={t("assets.workspace.filterAccount")} value={filters.accountId ?? ""} onChange={(event) => onChange("accountId", event.target.value || null)} className="h-10 rounded-xl border border-[var(--color-border)] bg-background px-3 text-sm">
          <option value="">{t("holdings.filters.allAccounts")}</option>
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </select>
        <select aria-label={t("assets.filters.currency")} value={filters.currency ?? ""} onChange={(event) => onChange("currency", event.target.value || null)} className="h-10 rounded-xl border border-[var(--color-border)] bg-background px-3 text-sm">
          <option value="">{t("assets.filters.allCurrencies")}</option>
          {currencyOptions.map((currency) => <option key={currency.value} value={currency.value}>{currency.value}</option>)}
        </select>
        <details className="relative">
          <summary className="flex h-10 cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-3 text-sm font-medium focus-visible:ring-2">
            <SlidersHorizontal size={15} /> {t("assets.workspace.moreFilters")}
          </summary>
          <div className="absolute end-0 z-20 mt-2 grid w-64 gap-4 rounded-xl border border-[var(--color-border)] bg-popover p-4 shadow-md">
            <label className="grid gap-1.5 text-xs font-medium">{t("assets.workspace.lifecycleLabel")}<select value={filters.lifecycle} onChange={(event) => onChange("lifecycle", event.target.value as AssetWorkspaceFilters["lifecycle"])} className="h-9 rounded-lg border bg-background px-2 text-sm"><option value="active">{t("assets.card.active")}</option><option value="archived">{t("assets.card.archived")}</option><option value="all">{t("assets.workspace.allStatuses")}</option></select></label>
            <label className="grid gap-1.5 text-xs font-medium">{t("assets.workspace.originLabel")}<select value={filters.origin} onChange={(event) => onChange("origin", event.target.value as AssetOrigin | "all")} className="h-9 rounded-lg border bg-background px-2 text-sm"><option value="all">{t("assets.workspace.allOrigins")}</option><option value="global">{t("assets.card.global")}</option><option value="custom">{t("assets.card.custom")}</option></select></label>
          </div>
        </details>
      </div>
      <p className="mt-3 text-xs text-muted-foreground" role="status">
        {t("assets.workspace.results", { count: resultCount })}
      </p>
    </div>
  )
}
