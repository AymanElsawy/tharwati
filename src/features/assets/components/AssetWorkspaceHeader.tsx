import { Clock3, Plus, ShieldAlert } from "lucide-react"

import type { AssetWorkspaceSnapshot } from "@/features/assets/types/asset-workspace"
import { useTranslation } from "@/i18n/useTranslation"

export function AssetWorkspaceHeader({
  snapshot,
  isRefreshing,
  onScopeChange,
  onAdd,
}: {
  snapshot: AssetWorkspaceSnapshot
  isRefreshing: boolean
  onScopeChange: (id: string | null) => void
  onAdd: () => void
}) {
  const { t, language } = useTranslation()
  const updated = new Intl.DateTimeFormat(
    language === "ar" ? "ar-SA" : "en-US",
    { dateStyle: "medium", timeStyle: "short" },
  ).format(new Date(snapshot.updatedAt))
  return (
    <header className="grid gap-6 border-b border-[var(--border-subtle)] pb-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
      <div>
        <p className="tharwati-eyebrow">{t("assets.workspace.eyebrow")}</p>
        <h1 className="tharwati-page-title mt-2">{t("assets.page.title")}</h1>
        <p className="tharwati-page-description mt-2 max-w-2xl">
          {t("assets.workspace.description")}
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="grid min-w-56 gap-1.5 text-xs font-semibold text-muted-foreground">
          {t("assets.workspace.scope")}
          <select
            value={snapshot.activeScopeId ?? ""}
            onChange={(event) => onScopeChange(event.target.value || null)}
            disabled={isRefreshing}
            className="h-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-semibold outline-none focus-visible:ring-2 disabled:opacity-60"
          >
            <option value="">{t("assets.workspace.allAssets")}</option>
            {snapshot.scopeOptions.map((scope) => (
              <option key={scope.id} value={scope.id}>{scope.name}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={onAdd}
          className="tharwati-button-primary h-10 !min-h-10 gap-2 !rounded-xl !py-2"
        >
          <Plus size={16} aria-hidden="true" />
          {t("assets.workspace.add")}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground lg:col-span-2">
        <span>{t("assets.workspace.records", { count: snapshot.recordCount })}</span>
        <span>{t("assets.workspace.owned", { count: snapshot.ownedCount })}</span>
        <span className="inline-flex items-center gap-1.5">
          <ShieldAlert size={14} aria-hidden="true" />
          {t("assets.workspace.issues", { count: snapshot.issueCount })}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock3 size={14} aria-hidden="true" />
          {isRefreshing
            ? t("assets.workspace.updating")
            : t("assets.workspace.updated", { date: updated })}
        </span>
      </div>
    </header>
  )
}
