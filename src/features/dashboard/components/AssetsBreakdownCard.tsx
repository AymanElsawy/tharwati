import { AlertTriangle, Layers3 } from "lucide-react"

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
  return <article className="tharwati-card p-5 sm:p-6">
    <div className="flex items-center justify-between gap-3"><div><h2 className="font-bold">{t("dashboard.assetsBreakdown.title")}</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t("dashboard.assetsBreakdown.description")}</p></div><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]"><Layers3 className="size-5" /></span></div>
    {items.length === 0 ? <p className="mt-6 text-sm text-[var(--color-text-secondary)]">{t("dashboard.assetsBreakdown.empty")}</p> : <><div className="mt-6 flex h-4 overflow-hidden rounded-full bg-[var(--color-surface-hover)]" aria-label={t("dashboard.assetsBreakdown.chartLabel")}>{items.map((item) => <span key={item.group} style={{ width: `${item.percentage}%`, backgroundColor: item.color }} title={t(item.labelKey)} />)}</div><ul className="mt-5 grid gap-3" aria-label={t("dashboard.assetsBreakdown.legendLabel")}>{items.map((item) => <li key={item.group} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2"><span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} /><span className="min-w-0 text-sm">{t(item.labelKey)}</span><span className="shrink-0 text-sm tabular-nums" dir="ltr">{formatPortfolioAmount(item.value, aggregate.baseCurrencyCode, locale)}</span><span className="shrink-0 text-xs text-[var(--color-text-muted)] tabular-nums" dir="ltr">{formatPortfolioPercent(item.percentage, locale)}</span></li>)}</ul></>}
    <div className="mt-6 flex items-center justify-between border-t border-[var(--color-border)] pt-4 text-sm"><span className="font-medium text-[var(--color-text-secondary)]">{t("dashboard.assetsBreakdown.totalLiabilities")}</span><span className="font-semibold tabular-nums" dir="ltr">{formatPortfolioAmount(aggregate.totalLiabilities, aggregate.baseCurrencyCode, locale)}</span></div>
  </article>
}
