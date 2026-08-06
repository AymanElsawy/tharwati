import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { PortfolioHoldingEvidence } from "@/features/portfolio/types/portfolio-evidence"
import { formatPortfolioAmount, formatPortfolioDecimal, formatPortfolioPercent } from "@/features/portfolio/utils/portfolio-formatters"
import { useTranslation } from "@/i18n/useTranslation"
import { portfolioQuantityUnitLabel } from "@/features/portfolio/utils/portfolio-labels"

export function PortfolioHoldingDetail({
  holding,
  open,
  onOpenChange,
  baseCurrency,
}: {
  holding: PortfolioHoldingEvidence | null
  open: boolean
  onOpenChange: (open: boolean) => void
  baseCurrency: string
}) {
  const { t, language } = useTranslation()
  const locale = language === "ar" ? "ar-SA" : "en-US"
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {holding ? (
          <>
            <SheetHeader className="border-b border-[var(--border-subtle)] px-6 py-6">
              <SheetTitle className="text-xl">{holding.assetName}</SheetTitle>
              <SheetDescription>{holding.symbol ?? t("portfolio.evidence.noSymbol")} · {holding.assetClass}</SheetDescription>
            </SheetHeader>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-6 p-6">
              {[
                [t("portfolio.evidence.quantity"), `${formatPortfolioDecimal(holding.quantity, locale, 8)} ${portfolioQuantityUnitLabel(holding.unit, t)}`],
                [t("portfolio.evidence.averageCost"), formatPortfolioAmount(holding.averageCost, holding.costCurrency, locale)],
                [t("portfolio.evidence.totalCost"), formatPortfolioAmount(holding.totalCostBasis, holding.costCurrency, locale)],
                [t("portfolio.evidence.currentPrice"), formatPortfolioAmount(holding.currentPrice, holding.priceCurrency ?? holding.costCurrency, locale)],
                [t("portfolio.evidence.marketValue"), formatPortfolioAmount(holding.marketValueBase, baseCurrency, locale)],
                [t("portfolio.evidence.return"), formatPortfolioPercent(holding.returnPercent, locale)],
                [t("portfolio.evidence.account"), holding.accountName],
                [t("portfolio.evidence.priceSource"), holding.priceSource ?? "—"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
                  <dd className="mt-1.5 tabular-nums text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mx-6 border-t border-[var(--border-subtle)] py-5 text-sm text-muted-foreground">
              {holding.dataQuality === "complete"
                ? t("portfolio.evidence.dataComplete")
                : t(`portfolio.evidence.status.${holding.dataQuality}`)}
            </div>
            {holding.dataQuality === "missing_price" ? (
              <a
                href={`/market-prices?assetId=${encodeURIComponent(holding.assetId)}`}
                className="mx-6 mb-6 inline-flex h-10 items-center justify-center bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2"
              >
                {t("portfolio.evidence.addPrice")}
              </a>
            ) : null}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
