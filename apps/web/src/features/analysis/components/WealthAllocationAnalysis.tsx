import { AlertTriangle, Layers3 } from "lucide-react"
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts"

import type { WealthAnalysisEvidence } from "@/features/analysis/utils/wealth-analysis"
import {
  formatWealthAnalysisAmount,
  formatWealthAnalysisPercent,
} from "@/features/analysis/utils/wealth-analysis-formatters"
import type { DashboardAggregate } from "@/features/dashboard/services/dashboard-aggregate.service"
import { useTranslation } from "@/i18n/useTranslation"
import { compareDecimals } from "@/lib/financial-calculations/decimal"

export function WealthAllocationAnalysis({
  aggregate,
  evidence,
}: {
  aggregate: DashboardAggregate
  evidence: WealthAnalysisEvidence
}) {
  const { t } = useTranslation()
  const allocated = evidence.assetClasses
    .filter(({ percentage }) => percentage !== null)
    .sort(
      (left, right) => compareDecimals(right.percentage!, left.percentage!) ?? 0
    )
  const chartData = allocated.map((assetClass) => ({
    ...assetClass,
    chartValue: Number(assetClass.percentage),
  }))

  return (
    <section aria-labelledby="wealth-allocation-title">
      <header className="tharwati-section-header">
        <p className="tharwati-eyebrow">{t("analysis.allocation.eyebrow")}</p>
        <h2
          id="wealth-allocation-title"
          className="tharwati-section-title mt-2"
        >
          {t("analysis.allocation.title")}
        </h2>
        <p className="tharwati-section-description">
          {t("analysis.allocation.description")}
        </p>
      </header>

      {aggregate.status === "incomplete" ? (
        <div className="flex items-start gap-3 border-y border-[var(--color-border)] py-6 text-amber-800 dark:text-amber-300">
          <AlertTriangle
            className="mt-0.5 size-5 shrink-0"
            aria-hidden="true"
          />
          <div>
            <h3 className="font-bold">
              {t("analysis.allocation.unavailableTitle")}
            </h3>
            <p className="mt-1 text-sm">
              {t("analysis.allocation.unavailableDescription")}
            </p>
          </div>
        </div>
      ) : allocated.length === 0 ? (
        <p className="border-y border-[var(--color-border)] py-6 text-sm text-[var(--color-text-secondary)]">
          {t("analysis.allocation.empty")}
        </p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.2fr)] lg:items-center">
          <div
            className="relative mx-auto aspect-square w-full max-w-72"
            role="img"
            aria-label={t("analysis.allocation.chartLabel")}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="chartValue"
                  nameKey="group"
                  innerRadius="62%"
                  outerRadius="88%"
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {chartData.map((assetClass) => (
                    <Cell key={assetClass.group} fill={assetClass.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-10 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-medium text-[var(--color-text-secondary)]">
                {t("analysis.allocation.valuedTotal")}
              </span>
              <strong className="mt-1 text-sm font-bold tabular-nums" dir="ltr">
                {formatWealthAnalysisAmount(
                  aggregate.totalAssets,
                  aggregate.baseCurrencyCode
                )}
              </strong>
              <span
                className="mt-1 text-[10px] font-medium text-[var(--color-primary)]"
                dir="ltr"
              >
                {t("analysis.allocation.completeCoverage")}
              </span>
            </div>
          </div>

          <div className="min-w-0">
            <ul
              className="grid gap-3"
              aria-label={t("analysis.allocation.legendLabel")}
            >
              {allocated.map((assetClass) => (
                <li
                  key={assetClass.group}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3"
                >
                  <span
                    aria-hidden="true"
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: assetClass.color }}
                  />
                  <div className="min-w-0">
                    <h3 className="font-bold">{t(assetClass.labelKey)}</h3>
                    <p
                      className="mt-1 text-sm text-[var(--color-text-secondary)] tabular-nums"
                      dir="ltr"
                    >
                      {formatWealthAnalysisAmount(
                        assetClass.value,
                        aggregate.baseCurrencyCode
                      )}
                    </p>
                  </div>
                  <strong className="shrink-0 tabular-nums" dir="ltr">
                    {formatWealthAnalysisPercent(assetClass.percentage)}
                  </strong>
                </li>
              ))}
            </ul>

            <aside className="mt-6 border-t border-[var(--color-border)] pt-4">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                  <Layers3 size={18} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-bold">
                    {t("analysis.allocation.contextTitle")}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
                    {evidence.largestExposure?.percentage ? (
                      <>
                        {t("analysis.allocation.contextPrefix")}{" "}
                        {t(evidence.largestExposure.labelKey)}{" "}
                        {t("analysis.allocation.contextAt")}{" "}
                        <bdi dir="ltr">
                          {formatWealthAnalysisPercent(
                            evidence.largestExposure.percentage
                          )}
                        </bdi>
                      </>
                    ) : (
                      t("analysis.allocation.empty")
                    )}
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}
    </section>
  )
}
