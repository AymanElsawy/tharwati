import { Clock3, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import type {
  AccountsWorkspaceSnapshot,
  AccountWorkspaceScope,
} from "@/features/accounts/types/account-workspace"
import { useTranslation } from "@/i18n/useTranslation"

type AccountWorkspaceHeaderProps = {
  snapshot: AccountsWorkspaceSnapshot
  isRefreshing: boolean
  onScopeChange: (scope: AccountWorkspaceScope) => void
  onAdd: () => void
}

export function AccountWorkspaceHeader({
  snapshot,
  isRefreshing,
  onScopeChange,
  onAdd,
}: AccountWorkspaceHeaderProps) {
  const { t, language } = useTranslation()
  const updated = new Intl.DateTimeFormat(
    language === "ar" ? "ar-SA" : "en-US",
    { dateStyle: "medium", timeStyle: "short" },
  ).format(new Date(snapshot.updatedAt))

  return (
    <header className="grid gap-6 border-b border-[var(--border-subtle)] pb-7 lg:grid-cols-[1fr_auto] lg:items-end">
      <div>
        <p className="tharwati-eyebrow">{t("accounts.workspace.eyebrow")}</p>
        <h1 className="tharwati-page-title mt-2">{t("accounts.page.title")}</h1>
        <p className="tharwati-page-description mt-2 max-w-2xl">
          {t("accounts.workspace.description")}
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="grid w-full min-w-0 gap-1.5 text-xs font-semibold text-muted-foreground sm:min-w-56 sm:flex-1">
          {t("accounts.workspace.scope")}
          <select
            value={snapshot.scope}
            onChange={(event) =>
              onScopeChange(event.target.value as AccountWorkspaceScope)
            }
            disabled={isRefreshing}
            className="h-10 rounded-xl border border-[var(--border-subtle)] bg-background px-3 text-sm"
          >
            <option value="all">{t("accounts.workspace.scopeAll")}</option>
            <option value="wealth_cash">{t("accounts.workspace.scopeCash")}</option>
          </select>
        </label>
        <Button onClick={onAdd} className="w-full sm:w-auto">
          <Plus size={16} />
          {t("accounts.actions.add")}
        </Button>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground lg:col-span-2">
        <span>{t("accounts.workspace.count", { count: snapshot.accountCount })}</span>
        <span>{t("accounts.workspace.active", { count: snapshot.activeCount })}</span>
        <span>{t("accounts.workspace.archived", { count: snapshot.archivedCount })}</span>
        <span className="inline-flex items-center gap-1.5">
          <Clock3 size={14} />
          {isRefreshing
            ? t("accounts.workspace.updating")
            : t("accounts.workspace.updated", { date: updated })}
        </span>
        <span>{t("accounts.workspace.reportingContext")}</span>
      </div>
    </header>
  )
}
