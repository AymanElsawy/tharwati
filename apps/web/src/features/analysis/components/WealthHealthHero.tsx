import type { DashboardAggregate } from "@/features/dashboard/services/dashboard-aggregate.service"
import { formatWealthAnalysisAmount } from "@/features/analysis/utils/wealth-analysis-formatters"
import { useTranslation } from "@/i18n/useTranslation"

export function WealthHealthHero({
  aggregate,
}: {
  aggregate: DashboardAggregate
}) {
  const { t } = useTranslation()
  const unavailable = t("analysis.value.unavailable")
  const money = (value: string | null) =>
    value === null
      ? unavailable
      : formatWealthAnalysisAmount(value, aggregate.baseCurrencyCode)
  const synthesisKey =
    aggregate.status === "incomplete"
      ? "analysis.health.synthesis.incomplete"
      : aggregate.freshness === "stale"
        ? "analysis.health.synthesis.stale"
        : "analysis.health.synthesis.current"

  return (
    <section className="overflow-hidden rounded-3xl border border-[var(--color-primary)]/20 bg-[var(--color-surface)] shadow-[0_20px_55px_rgba(15,23,42,0.08)]">
      <div className="relative overflow-hidden p-6 sm:p-8">
        <div
          className="absolute inset-y-0 start-0 w-1 bg-[var(--color-primary)]"
          aria-hidden="true"
        />
        <div className="grid items-end gap-5 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative">
            <div
              aria-hidden="true"
              className="absolute -end-20 -top-24 size-72 rounded-full bg-[var(--color-primary-soft)] blur-3xl"
            />
            <div className="relative">
              <p className="tharwati-eyebrow">{t("analysis.health.eyebrow")}</p>
              <h2 className="font-heading mt-3 text-2xl font-black sm:text-3xl">
                {t("analysis.health.title")}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
                {t(synthesisKey)}
              </p>
            </div>
          </div>
          <div className="relative rounded-2xl bg-[var(--color-surface-muted)] px-4 py-3 lg:text-end">
            <p className="text-xs font-semibold text-[var(--color-text-secondary)]">
              {t("analysis.health.netWealth")}
            </p>
            <p className="mt-1 text-base font-bold tabular-nums" dir="ltr">
              {money(aggregate.netWorth)}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
