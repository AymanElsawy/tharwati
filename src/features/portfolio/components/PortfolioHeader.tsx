import { AlertTriangle, CheckCircle2, Clock3, Shapes } from "lucide-react"

import type { PortfolioExecutiveViewModel } from "@/features/portfolio/types/portfolio-executive"
import { useTranslation } from "@/i18n/useTranslation"

type Props = {
  portfolio: PortfolioExecutiveViewModel
  isUpdating: boolean
  onScopeChange: (scopeId: string | null) => void
}

export function PortfolioHeader({
  portfolio,
  isUpdating,
  onScopeChange,
}: Props) {
  const { language, t } = useTranslation()
  const isComplete = portfolio.completenessStatus === "complete"
  const StatusIcon = isComplete ? CheckCircle2 : AlertTriangle
  const updatedAt = new Intl.DateTimeFormat(
    language === "ar" ? "ar-SA" : "en-US",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(new Date(portfolio.updatedAt))

  return (
    <header
      id="portfolio-header"
      className="grid gap-6 border-b border-[var(--border-subtle)] pb-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end"
    >
      <div className="min-w-0">
        <p className="tharwati-eyebrow">{t("portfolio.header.eyebrow")}</p>
        <h1 className="tharwati-page-title mt-2">
          {t("portfolio.header.title")}
        </h1>
        <p className="tharwati-page-description mt-2 max-w-2xl">
          {t("portfolio.header.description")}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="grid w-full min-w-0 gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)] sm:min-w-56">
          {t("portfolio.header.scope")}
          <select
            value={portfolio.activeScopeId ?? ""}
            onChange={(event) => onScopeChange(event.target.value || null)}
            disabled={isUpdating}
            className="h-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-semibold text-[var(--color-text)] transition outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:cursor-wait disabled:opacity-60"
          >
            <option value="">{t("portfolio.header.allAccounts")}</option>
            {portfolio.scopeOptions.map((scope) => (
              <option key={scope.id} value={scope.id}>
                {scope.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("tharwati:add-investment"))
          }
          className="tharwati-button-primary h-10 w-full !min-h-10 gap-2 !rounded-xl !py-2 sm:w-auto"
        >
          <Shapes size={16} aria-hidden="true" />
          {t("investment.primaryAction")}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--color-text-secondary)] lg:col-span-2 lg:justify-end">
        <span className="flex items-center gap-1.5">
          <StatusIcon
            size={14}
            className={
              isComplete
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-amber-700 dark:text-amber-400"
            }
            aria-hidden="true"
          />
          {isComplete
            ? t("portfolio.header.complete")
            : t("portfolio.header.incomplete")}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock3 size={14} aria-hidden="true" />
          {isUpdating
            ? t("portfolio.header.updating")
            : t("portfolio.header.updated", { date: updatedAt })}
        </span>
        <span dir="ltr">{portfolio.baseCurrency}</span>
      </div>
    </header>
  )
}
