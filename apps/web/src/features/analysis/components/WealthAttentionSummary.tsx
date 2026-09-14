import { AlertTriangle, BadgeCheck, Clock3 } from "lucide-react"

import type { DashboardAggregate } from "@/features/dashboard/services/dashboard-aggregate.service"
import { useTranslation } from "@/i18n/useTranslation"

export function WealthAttentionSummary({
  aggregate,
}: {
  aggregate: DashboardAggregate
}) {
  const { t } = useTranslation()
  const items = []

  if (aggregate.status === "incomplete") {
    items.push({
      id: "incomplete",
      Icon: AlertTriangle,
      tone: "text-amber-700 dark:text-amber-300",
      title: t("analysis.attention.incompleteTitle"),
      description: (
        <>
          {t("analysis.attention.unresolvedPrefix")}{" "}
          <bdi dir="ltr">{new Set(aggregate.unavailableSources).size}</bdi>{" "}
          {t("analysis.attention.unresolvedSuffix")}
        </>
      ),
    })
  }
  if (aggregate.freshness === "stale") {
    items.push({
      id: "stale",
      Icon: Clock3,
      tone: "text-amber-700 dark:text-amber-300",
      title: t("analysis.attention.staleTitle"),
      description: t("analysis.attention.staleDescription"),
    })
  }
  if (items.length === 0) {
    return (
      <section aria-labelledby="wealth-attention-title">
        <header className="mb-3">
          <p className="tharwati-eyebrow">{t("analysis.attention.eyebrow")}</p>
          <h2
            id="wealth-attention-title"
            className="mt-1 font-heading text-xl font-extrabold text-[var(--color-text-primary)]"
          >
            {t("analysis.attention.title")}
          </h2>
        </header>
        <aside className="flex max-w-2xl items-center gap-3 rounded-2xl border border-emerald-600/15 bg-emerald-500/5 px-4 py-3">
          <BadgeCheck className="size-5 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
          <div>
            <h3 className="text-sm font-bold">{t("analysis.attention.noneTitle")}</h3>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
              {t("analysis.attention.noneDescription")}
            </p>
          </div>
        </aside>
      </section>
    )
  }

  return (
    <section aria-labelledby="wealth-attention-title">
      <header className="tharwati-section-header mb-5">
        <p className="tharwati-eyebrow">{t("analysis.attention.eyebrow")}</p>
        <h2 id="wealth-attention-title" className="tharwati-section-title mt-2">
          {t("analysis.attention.title")}
        </h2>
        <p className="tharwati-section-description">
          {t("analysis.attention.description")}
        </p>
      </header>
      <div className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
        {items.map(({ id, Icon, tone, title, description }) => (
          <article key={id} className="flex items-start gap-4 py-4">
            <Icon className={`mt-0.5 size-5 shrink-0 ${tone}`} aria-hidden="true" />
            <div>
              <h3 className="font-bold">{title}</h3>
              <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
                {description}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
