import { AlertTriangle, Layers3 } from "lucide-react"
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts"

import type { DashboardAggregate } from "@/features/dashboard/services/dashboard-aggregate.service"
import { formatPortfolioAmount, formatPortfolioPercent } from "@/features/portfolio/utils/portfolio-formatters"
import { useTranslation } from "@/i18n/useTranslation"
import { getDashboardBreakdownItems } from "@/features/dashboard/utils/assets-breakdown"

export function AssetsBreakdownCard({ aggregate, isLoading }: { aggregate: DashboardAggregate | null; isLoading: boolean }) {
  const { t, language } = useTranslation()
  const locale = language === "ar" ? "ar-SA" : "en-US"
  if (isLoading) return <article aria-label={t("dashboard.assetsBreakdown.loading")} className="tharwati-card min-h-64 animate-pulse p-6"><div className="h-4 w-36 rounded bg-[var(--color-surface-hover)]" /><div className="mt-6 h-5 rounded-full bg-[var(--color-surface-hover)]" /></article>
  if (!aggregate || aggregate.status === "incomplete") return <article className="tharwati-card p-6"><div className="flex items-center gap-2 text-amber-800 dark:text-amber-300"><AlertTriangle className="size-5" /><h2 className="font-bold">{t("dashboard.assetsBreakdown.title")}</h2></div><p className="mt-3 text-sm text-[var(--color-text-secondary)]">{t("dashboard.assetsBreakdown.unavailable")}</p></article>

  const items = getDashboardBreakdownItems(aggregate)
  const chartData = items.map((item) => ({ ...item, chartValue: Number(item.percentage) }))
  return <article className="tharwati-card h-full p-5 sm:p-6">
    <div className="flex items-center justify-between gap-3"><div><h2 className="font-bold">{t("dashboard.assetsBreakdown.title")}</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t("dashboard.assetsBreakdown.description")}</p></div><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]"><Layers3 className="size-5" /></span></div>
    {items.length === 0 ? <p className="mt-6 text-sm text-[var(--color-text-secondary)]">{t("dashboard.assetsBreakdown.empty")}</p> : <div className="mt-5 grid gap-5 md:grid-cols-[12rem_minmax(0,1fr)] md:items-center"><div className="relative mx-auto h-52 w-full min-h-52 min-w-52 max-w-52 md:h-48 md:w-48" role="img" aria-label={t("dashboard.assetsBreakdown.chartLabel")}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartData} dataKey="chartValue" nameKey="group" innerRadius={58} outerRadius={84} paddingAngle={2} strokeWidth={0}>{chartData.map((item) => <Cell key={item.group} fill={item.color} />)}</Pie></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-10 flex flex-col items-center justify-center text-center"><span className="text-[10px] font-medium text-[var(--color-text-secondary)]">{t("dashboard.assetsBreakdown.totalAssets")}</span><strong className="mt-1 text-sm font-bold tabular-nums" dir="ltr">{formatPortfolioAmount(aggregate.totalAssets, aggregate.baseCurrencyCode, locale)}</strong></div></div><ul className="grid gap-3" aria-label={t("dashboard.assetsBreakdown.legendLabel")}>{items.map((item) => <li key={item.group} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2"><span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} /><span className="min-w-0 text-sm">{t(item.labelKey)}</span><span className="shrink-0 text-sm tabular-nums" dir="ltr">{formatPortfolioAmount(item.value, aggregate.baseCurrencyCode, locale)}</span><span className="shrink-0 text-xs text-[var(--color-text-muted)] tabular-nums" dir="ltr">{formatPortfolioPercent(item.percentage, locale)}</span></li>)}</ul></div>}
    <div className="mt-6 flex items-center justify-between border-t border-[var(--color-border)] pt-4 text-sm"><span className="font-medium text-[var(--color-text-secondary)]">{t("dashboard.assetsBreakdown.totalLiabilities")}</span><span className="font-semibold tabular-nums" dir="ltr">{formatPortfolioAmount(aggregate.totalLiabilities, aggregate.baseCurrencyCode, locale)}</span></div>
  </article>
}
