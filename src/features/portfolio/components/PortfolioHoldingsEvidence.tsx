import { ArrowUpDown, Search } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import type { PortfolioHoldingEvidence, PortfolioHoldingSort } from "@/features/portfolio/types/portfolio-evidence"
import type { PortfolioScopeOption } from "@/features/portfolio/types/portfolio-executive"
import { formatPortfolioAmount, formatPortfolioDecimal, formatPortfolioPercent } from "@/features/portfolio/utils/portfolio-formatters"
import { useTranslation } from "@/i18n/useTranslation"
import { cn } from "@/lib/utils"
import { portfolioAssetClassLabel, portfolioQuantityUnitLabel } from "@/features/portfolio/utils/portfolio-labels"
import type { TranslationKey } from "@/i18n/en/translations"
import { Link } from "react-router-dom"
import { PortfolioSectionHeading } from "@/features/portfolio/components/PortfolioSectionHeading"

const columns: Array<[PortfolioHoldingSort, TranslationKey]> = [
  ["asset", "portfolio.evidence.asset"],
  ["account", "portfolio.evidence.account"],
  ["quantity", "portfolio.evidence.quantity"],
  ["average_cost", "portfolio.evidence.averageCost"],
  ["cost_basis", "portfolio.evidence.totalCost"],
  ["current_price", "portfolio.evidence.currentPrice"],
  ["market_value", "portfolio.evidence.marketValue"],
  ["gain_loss", "portfolio.evidence.gainLoss"],
  ["return", "portfolio.evidence.return"],
]

export function PortfolioHoldingsEvidence({
  holdings,
  allCount,
  scopes,
  baseCurrency,
  filters,
  onSearch,
  onAccount,
  onAssetClass,
  onSort,
  onOpen,
}: {
  holdings: PortfolioHoldingEvidence[]
  allCount: number
  scopes: PortfolioScopeOption[]
  baseCurrency: string
  filters: { search: string; accountId: string | null; assetClass: string | null; sort: PortfolioHoldingSort; direction: "asc" | "desc"; hasInherited: boolean }
  onSearch: (value: string) => void
  onAccount: (value: string | null) => void
  onAssetClass: (value: string | null) => void
  onSort: (value: PortfolioHoldingSort) => void
  onOpen: (id: string) => void
}) {
  const { t, language } = useTranslation()
  const locale = language === "ar" ? "ar-SA" : "en-US"
  const assetClasses = [...new Set(holdings.map((item) => item.assetClass))]
  const hasLocalFilters = Boolean(filters.search || filters.accountId || filters.assetClass)
  return (
    <section aria-labelledby="portfolio-holdings-title" className="border-t border-[var(--border-subtle)] pt-10">
      <PortfolioSectionHeading
        eyebrow={t("portfolio.evidence.positions")}
        title={t("portfolio.evidence.holdings")}
        titleId="portfolio-holdings-title"
        action={<Link to="/assets" className={cn(buttonVariants())}>{t("investment.primaryAction")}</Link>}
      />
      <div className="mt-6 grid gap-3 md:grid-cols-[minmax(14rem,1fr)_12rem_12rem]">
        <label className="relative">
          <span className="sr-only">{t("holdings.filters.search")}</span>
          <Search className="pointer-events-none absolute start-3 top-3 text-muted-foreground" size={16} />
          <input value={filters.search} onChange={(event) => onSearch(event.target.value)} placeholder={t("holdings.filters.searchPlaceholder")} className="h-10 w-full border border-[var(--border-subtle)] bg-transparent ps-9 pe-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]" />
        </label>
        <select aria-label={t("holdings.filters.account")} value={filters.accountId ?? ""} onChange={(event) => onAccount(event.target.value || null)} className="h-10 border border-[var(--border-subtle)] bg-background px-3 text-sm">
          <option value="">{t("holdings.filters.allAccounts")}</option>
          {scopes.map((scope) => <option key={scope.id} value={scope.id}>{scope.name}</option>)}
        </select>
        <select aria-label={t("holdings.filters.assetType")} value={filters.assetClass ?? ""} onChange={(event) => onAssetClass(event.target.value || null)} className="h-10 border border-[var(--border-subtle)] bg-background px-3 text-sm">
          <option value="">{t("holdings.filters.allTypes")}</option>
          {assetClasses.map((assetClass) => <option key={assetClass} value={assetClass}>{portfolioAssetClassLabel(assetClass, t)}</option>)}
        </select>
      </div>
      {filters.hasInherited ? <p className="mt-3 text-xs text-muted-foreground">{t("portfolio.evidence.inheritedFilter")}</p> : null}
      {holdings.length === 0 ? (
        <div className="py-14 text-center">
          <h3 className="font-heading text-lg">{allCount === 0 ? t("holdings.empty.title") : t("holdings.filters.noResults")}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{allCount === 0 ? t("holdings.empty.description") : hasLocalFilters ? t("portfolio.evidence.adjustFilters") : t("portfolio.evidence.noInheritedMatches")}</p>
        </div>
      ) : (
        <>
          <div className="mt-5 hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1450px] text-sm">
              <thead className="sticky top-0 z-10 bg-background">
                <tr className="border-y border-[var(--border-subtle)]">
                  {columns.map(([id, key]) => <th key={id} scope="col" aria-sort={filters.sort === id ? (filters.direction === "asc" ? "ascending" : "descending") : "none"} className={`px-3 py-3 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground ${id === "asset" || id === "account" ? "text-start" : "text-end"}`}><button type="button" onClick={() => onSort(id)} className="inline-flex items-center gap-1 rounded-sm focus-visible:outline-none focus-visible:ring-2"><span>{t(key)}</span><ArrowUpDown size={13} aria-hidden="true" /></button></th>)}
                  <th className="px-3 py-3 text-start text-xs text-muted-foreground">{t("portfolio.evidence.data")}</th>
                  <th className="px-3 py-3 text-start text-xs text-muted-foreground">{t("portfolio.evidence.priceTime")}</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((holding) => (
                  <tr key={holding.id} className="border-b border-[var(--border-subtle)] hover:bg-muted/30">
                    <td className="px-3 py-4"><button type="button" onClick={() => onOpen(holding.id)} className="text-start font-medium focus-visible:outline-none focus-visible:ring-2">{holding.assetName}<span className="block text-xs font-normal text-muted-foreground">{holding.symbol ?? holding.assetClass}</span></button></td>
                    <td className="px-3 py-4">{holding.accountName}</td>
                    <td className="px-3 py-4 text-end tabular-nums"><span dir="ltr">{formatPortfolioDecimal(holding.quantity, locale, 8)} <span className="text-xs text-muted-foreground">{portfolioQuantityUnitLabel(holding.unit, t)}</span></span></td>
                    <td className="px-3 py-4 text-end tabular-nums"><span dir="ltr">{formatPortfolioAmount(holding.averageCost, holding.costCurrency, locale)}</span></td>
                    <td className="px-3 py-4 text-end tabular-nums"><span dir="ltr">{formatPortfolioAmount(holding.totalCostBasis, holding.costCurrency, locale)}</span></td>
                    <td className="px-3 py-4 text-end tabular-nums"><span dir="ltr">{formatPortfolioAmount(holding.currentPrice, holding.priceCurrency ?? holding.costCurrency, locale)}</span></td>
                    <td className="px-3 py-4 text-end tabular-nums"><span dir="ltr">{holding.marketValueBase === null ? formatPortfolioAmount(null, baseCurrency, locale) : formatPortfolioAmount(holding.marketValueBase, baseCurrency, locale)}</span></td>
                    <td className="px-3 py-4 text-end tabular-nums"><span dir="ltr">{formatPortfolioAmount(holding.unrealizedGainLossBase, baseCurrency, locale)}</span></td>
                    <td className="px-3 py-4 text-end tabular-nums"><span dir="ltr">{formatPortfolioPercent(holding.returnPercent, locale)}</span></td>
                    <td className="px-3 py-4 text-xs text-muted-foreground">{t(`portfolio.evidence.status.${holding.dataQuality}`)}</td>
                    <td className="px-3 py-4 text-xs text-muted-foreground">{holding.priceTimestamp ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(holding.priceTimestamp)) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5 divide-y divide-[var(--border-subtle)] lg:hidden">
            {holdings.map((holding) => <button key={holding.id} type="button" onClick={() => onOpen(holding.id)} className="grid w-full grid-cols-[1fr_auto] gap-3 py-5 text-start focus-visible:outline-none focus-visible:ring-2"><span><strong className="block font-medium">{holding.assetName}</strong><span className="mt-1 block text-xs text-muted-foreground">{holding.accountName} · {formatPortfolioDecimal(holding.quantity, locale, 8)} {portfolioQuantityUnitLabel(holding.unit, t)}</span></span><span className="text-end tabular-nums"><strong className="block font-medium">{formatPortfolioAmount(holding.marketValueBase, baseCurrency, locale)}</strong><span className="mt-1 block text-xs text-muted-foreground">{formatPortfolioPercent(holding.returnPercent, locale)}</span></span></button>)}
          </div>
        </>
      )}
      <p className="mt-4 text-xs text-muted-foreground">{t("portfolio.evidence.openOnly")}</p>
    </section>
  )
}
