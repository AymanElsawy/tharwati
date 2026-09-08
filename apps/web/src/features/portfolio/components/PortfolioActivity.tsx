import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { PortfolioActivityItem } from "@/features/portfolio/types/portfolio-evidence"
import type { PortfolioScopeOption } from "@/features/portfolio/types/portfolio-executive"
import { formatPortfolioAmount } from "@/features/portfolio/utils/portfolio-formatters"
import { useTranslation } from "@/i18n/useTranslation"
import { useMemo } from "react"
import { PortfolioSectionHeading } from "@/features/portfolio/components/PortfolioSectionHeading"

export function PortfolioActivity({
  items,
  allItems,
  scopes,
  type,
  accountId,
  onType,
  onAccount,
  selectedId,
  onSelectedId,
}: {
  items: PortfolioActivityItem[]
  allItems: PortfolioActivityItem[]
  scopes: PortfolioScopeOption[]
  type: string | null
  accountId: string | null
  onType: (value: string | null) => void
  onAccount: (value: string | null) => void
  selectedId: string | null
  onSelectedId: (value: string | null) => void
}) {
  const { t, language } = useTranslation()
  const locale = language === "ar" ? "ar-SA" : "en-US"
  const types = useMemo(
    () => [...new Set(allItems.map((item) => item.type))],
    [allItems],
  )
  const selected = useMemo(
    () => allItems.find((item) => item.id === selectedId) ?? null,
    [allItems, selectedId],
  )
  const mediumDate = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }),
    [locale],
  )
  const longDate = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "long" }),
    [locale],
  )
  return (
    <section aria-labelledby="portfolio-activity-title" className="border-t border-[var(--border-subtle)] pt-10">
      <PortfolioSectionHeading
        eyebrow={t("portfolio.activity.eyebrow")}
        title={t("portfolio.activity.title")}
        titleId="portfolio-activity-title"
      />
      <div className="mt-5 flex flex-wrap gap-3">
        <select aria-label={t("portfolio.activity.filterType")} value={type ?? ""} onChange={(event) => onType(event.target.value || null)} className="h-10 border border-[var(--border-subtle)] bg-background px-3 text-sm"><option value="">{t("portfolio.activity.allTypes")}</option>{types.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <select aria-label={t("portfolio.activity.filterAccount")} value={accountId ?? ""} onChange={(event) => onAccount(event.target.value || null)} className="h-10 border border-[var(--border-subtle)] bg-background px-3 text-sm"><option value="">{t("holdings.filters.allAccounts")}</option>{scopes.map((scope) => <option key={scope.id} value={scope.id}>{scope.name}</option>)}</select>
      </div>
      {items.length === 0 ? <p className="py-12 text-sm text-muted-foreground">{allItems.length === 0 ? t("portfolio.activity.empty") : t("portfolio.activity.noMatches")}</p> : <ol className="mt-5 divide-y divide-[var(--border-subtle)]">{items.map((item) => <li key={item.id}><button type="button" onClick={() => onSelectedId(item.id)} aria-label={`${item.description}, ${formatPortfolioAmount(item.amount, item.currency, locale)}`} className="grid w-full gap-2 rounded-sm py-4 text-start focus-visible:outline-none focus-visible:ring-2 sm:grid-cols-[8rem_1fr_auto] sm:items-center"><time className="text-xs text-muted-foreground" dateTime={item.occurredAt}>{mediumDate.format(new Date(item.occurredAt))}</time><span><strong className="block font-medium">{item.description}</strong><span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{item.type} · {t("portfolio.activity.posted")}</span></span><span className="tabular-nums" dir="ltr">{formatPortfolioAmount(item.amount, item.currency, locale)}</span></button></li>)}</ol>}
      <p className="mt-4 text-xs text-muted-foreground">{t("portfolio.activity.recentOnly")}</p>
      <Sheet open={selected !== null} onOpenChange={(open) => { if (!open) onSelectedId(null) }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">{selected ? <><SheetHeader className="border-b border-[var(--border-subtle)] px-6 py-6"><SheetTitle>{selected.description}</SheetTitle><SheetDescription>{selected.type} · {t("portfolio.activity.posted")}</SheetDescription></SheetHeader><div className="p-6"><dl className="grid grid-cols-2 gap-5"><div><dt className="text-xs text-muted-foreground">{t("portfolio.activity.date")}</dt><dd className="mt-1">{longDate.format(new Date(selected.occurredAt))}</dd></div><div><dt className="text-xs text-muted-foreground">{t("portfolio.activity.amount")}</dt><dd className="mt-1 tabular-nums" dir="ltr">{formatPortfolioAmount(selected.amount, selected.currency, locale)}</dd></div></dl><h3 className="mt-8 text-xs uppercase tracking-[0.12em] text-muted-foreground">{t("portfolio.activity.entries")}</h3><ul className="mt-3 divide-y divide-[var(--border-subtle)]">{selected.entries.map((entry) => <li key={entry.id} className="flex justify-between gap-4 py-3"><span>{entry.memo ?? entry.side}</span><span className="tabular-nums" dir="ltr">{formatPortfolioAmount(entry.amount, selected.currency, locale)}</span></li>)}</ul></div></> : null}</SheetContent>
      </Sheet>
    </section>
  )
}
