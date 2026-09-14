import { AlertTriangle, BadgeCheck, Clock3 } from "lucide-react"

import type { DashboardAggregate } from "@/features/dashboard/services/dashboard-aggregate.service"
import { useTranslation } from "@/i18n/useTranslation"

export function WealthValuationQuality({
  aggregate,
}: {
  aggregate: DashboardAggregate
}) {
  const { language, t } = useTranslation()
  const locale = language === "ar" ? "ar-EG" : "en-US"
  const complete = aggregate.status === "complete"
  const stale = aggregate.freshness === "stale"
  const asOf = aggregate.asOf
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(aggregate.asOf))
    : null
  const unresolvedCount = new Set(aggregate.unavailableSources).size

  return (
    <section aria-labelledby="wealth-quality-title">
      <header className="tharwati-section-header">
        <p className="tharwati-eyebrow">{t("analysis.quality.eyebrow")}</p>
        <h2 id="wealth-quality-title" className="tharwati-section-title mt-2">
          {t("analysis.quality.title")}
        </h2>
        <p className="tharwati-section-description">
          {t("analysis.quality.description")}
        </p>
      </header>
      <dl className="grid border-y border-[var(--color-border)] sm:grid-cols-3">
        <div className="p-5 sm:border-e sm:border-[var(--color-border)]">
          <dt className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            {complete ? <BadgeCheck size={17} /> : <AlertTriangle size={17} />}
            {t("analysis.quality.coverage")}
          </dt>
          <dd className="mt-3 font-bold">
            {complete
              ? t("analysis.coverage.complete")
              : t("analysis.coverage.incomplete")}
          </dd>
        </div>
        <div className="border-t border-[var(--color-border)] p-5 sm:border-e sm:border-t-0">
          <dt className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <Clock3 size={17} /> {t("analysis.quality.freshness")}
          </dt>
          <dd className="mt-3 font-bold">
            {stale ? t("analysis.quality.stale") : t("analysis.quality.current")}
          </dd>
          {asOf ? (
            <dd className="mt-1 text-xs text-[var(--color-text-secondary)]" dir="ltr">
              {asOf}
            </dd>
          ) : null}
        </div>
        <div className="border-t border-[var(--color-border)] p-5 sm:border-t-0">
          <dt className="text-sm text-[var(--color-text-secondary)]">
            {t("analysis.quality.unresolved")}
          </dt>
          <dd className="mt-3 text-xl font-black tabular-nums" dir="ltr">
            {unresolvedCount}
          </dd>
        </div>
      </dl>
    </section>
  )
}
