import { AlertTriangle, PieChart } from "lucide-react"
import {
  Cell,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
} from "recharts"

import type { DashboardPortfolioAllocation } from "@/features/dashboard/services/dashboard-valuation-snapshot.service"
import { getDashboardPortfolioAllocationItems } from "@/features/dashboard/utils/portfolio-allocation"
import {
  formatPortfolioAmount,
  formatPortfolioPercent,
} from "@/features/portfolio/utils/portfolio-formatters"
import { useTranslation } from "@/i18n/useTranslation"
import { addDecimals } from "@/lib/financial-calculations/decimal"

export function DashboardPortfolioAllocationCard({
  allocation,
  baseCurrencyCode,
  isLoading,
}: {
  allocation: DashboardPortfolioAllocation | null
  baseCurrencyCode: string | null
  isLoading: boolean
}) {
  const { t } = useTranslation()
  const locale = "en-US"

  if (isLoading)
    return (
      <article
        aria-label={t("dashboard.portfolioAllocation.loading")}
        className="tharwati-card min-h-64 animate-pulse p-6"
      >
        <div className="h-4 w-40 rounded bg-[var(--color-surface-hover)]" />
        <div className="mt-6 h-5 rounded-full bg-[var(--color-surface-hover)]" />
      </article>
    )
  if (!allocation || allocation.status === "incomplete" || !baseCurrencyCode)
    return (
      <article className="tharwati-card p-6">
        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
          <AlertTriangle className="size-5" />
          <h2 className="font-bold">
            {t("dashboard.portfolioAllocation.title")}
          </h2>
        </div>
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          {t("dashboard.portfolioAllocation.unavailable")}
        </p>
      </article>
    )

  const items = getDashboardPortfolioAllocationItems(
    allocation,
    baseCurrencyCode
  )
  const totalInvestments = items.reduce(
    (total, item) => addDecimals(total, item.value) ?? total,
    "0"
  )
  const chartData = items.map((item) => ({
    ...item,
    chartValue: Number(item.percentage),
  }))
  return (
    <article className="tharwati-card h-full p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">
            {t("dashboard.portfolioAllocation.title")}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {t("dashboard.portfolioAllocation.description")}
          </p>
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
          <PieChart className="size-5" />
        </span>
      </div>
      {items.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--color-text-secondary)]">
          {t("dashboard.portfolioAllocation.empty")}
        </p>
      ) : (
        <div className="mt-5 grid gap-5 md:grid-cols-[12rem_minmax(0,1fr)] md:items-center">
          <div
            className="relative mx-auto h-52 min-h-52 w-full max-w-52 min-w-52 md:h-48 md:w-48"
            role="img"
            aria-label={t("dashboard.portfolioAllocation.chartLabel")}
          >
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={chartData}
                  dataKey="chartValue"
                  nameKey="group"
                  innerRadius={58}
                  outerRadius={84}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {chartData.map((item) => (
                    <Cell key={item.group} fill={item.color} />
                  ))}
                </Pie>
              </RechartsPieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-10 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-medium text-[var(--color-text-secondary)]">
                {t("dashboard.portfolioAllocation.totalInvestments")}
              </span>
              <strong className="mt-1 text-sm font-bold tabular-nums" dir="ltr">
                {formatPortfolioAmount(
                  totalInvestments,
                  baseCurrencyCode,
                  locale
                )}
              </strong>
            </div>
          </div>
          <ul
            className="grid gap-3"
            aria-label={t("dashboard.portfolioAllocation.legendLabel")}
          >
            {items.map((item) => (
              <li key={item.group} className="min-w-0">
                <div className="flex min-w-0 items-start justify-between gap-3 md:hidden">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="min-w-0 text-sm break-words">
                      {t(item.labelKey)}
                    </span>
                  </div>
                  <div className="max-w-[58%] min-w-0 shrink-0 text-end">
                    <span
                      className="block text-sm break-words tabular-nums"
                      dir="ltr"
                    >
                      {formatPortfolioAmount(
                        item.value,
                        baseCurrencyCode,
                        locale
                      )}
                    </span>
                    <strong
                      className="mt-0.5 block text-xs font-bold text-[var(--color-text-primary)] tabular-nums"
                      dir="ltr"
                    >
                      {formatPortfolioPercent(item.percentage, locale)}
                    </strong>
                  </div>
                </div>
                <div className="hidden min-w-0 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-2 md:grid">
                  <span
                    aria-hidden="true"
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="min-w-0 text-sm break-words">
                    {t(item.labelKey)}
                  </span>
                  <span
                    className="shrink-0 text-xs font-semibold tabular-nums"
                    dir="ltr"
                  >
                    {formatPortfolioPercent(item.percentage, locale)}
                  </span>
                  <span
                    className="min-w-0 text-sm break-words tabular-nums"
                    dir="ltr"
                  >
                    {formatPortfolioAmount(
                      item.value,
                      baseCurrencyCode,
                      locale
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  )
}
