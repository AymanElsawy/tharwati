import { AlertTriangle, BadgeCheck, Clock3, Lightbulb } from "lucide-react"

import type { DashboardAggregate } from "@/features/dashboard/services/dashboard-aggregate.service"
import { useTranslation } from "@/i18n/useTranslation"

export function DashboardKeyInsights({
  aggregate,
  isLoading,
}: {
  aggregate: DashboardAggregate | null
  isLoading: boolean
}) {
  const { t } = useTranslation()
  if (isLoading)
    return (
      <section
        aria-label={t("dashboard.insights.title")}
        className="tharwati-card min-h-56 animate-pulse p-6"
      >
        <div className="h-5 w-32 rounded bg-[var(--color-surface-hover)]" />
      </section>
    )
  const incomplete = aggregate?.status === "incomplete",
    stale = aggregate?.freshness === "stale",
    empty = aggregate?.accountCount === 0
  const Icon = incomplete
    ? AlertTriangle
    : stale
      ? Clock3
      : empty
        ? Lightbulb
        : BadgeCheck
  const title = incomplete
    ? t("dashboard.insights.incompleteTitle")
    : stale
      ? t("dashboard.insights.staleTitle")
      : empty
        ? t("dashboard.insights.emptyTitle")
        : t("dashboard.insights.readyTitle")
  const description = incomplete
    ? t("dashboard.insights.incompleteDescription")
    : stale
      ? t("dashboard.insights.staleDescription")
      : empty
        ? t("dashboard.insights.emptyDescription")
        : t("dashboard.insights.readyDescription")
  return (
    <section
      className="tharwati-card h-full p-5 sm:p-6"
      aria-labelledby="dashboard-insights-title"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="dashboard-insights-title" className="font-bold">
            {t("dashboard.insights.title")}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {t("dashboard.insights.description")}
          </p>
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
          <Icon size={20} />
        </span>
      </div>
      <div className="mt-7 rounded-2xl bg-[var(--color-surface-muted)] p-4">
        <h3 className="font-semibold text-[var(--color-text-primary)]">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
          {description}
        </p>
      </div>
    </section>
  )
}
