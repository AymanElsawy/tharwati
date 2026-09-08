import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type {
  AssetActivityEvidence,
  AssetDetailViewModel,
  AssetRelationshipEvidence,
} from "@/features/assets/types/asset-workspace"
import {
  formatPortfolioAmount,
  formatPortfolioDecimal,
} from "@/features/portfolio/utils/portfolio-formatters"
import { portfolioQuantityUnitLabel } from "@/features/portfolio/utils/portfolio-labels"
import { useTranslation } from "@/i18n/useTranslation"

function Definition({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  )
}

export function AssetDetailPanel({
  detail,
  open,
  onOpenChange,
  onAccountScope,
  onOpenActivity,
  onEdit,
  onArchive,
  onDelete,
}: {
  detail: AssetDetailViewModel | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAccountScope: (id: string) => void
  onOpenActivity: (id: string) => void
  onEdit: () => void
  onArchive: () => void
  onDelete: () => void
}) {
  const { t, language } = useTranslation()
  const locale = language === "ar" ? "ar-SA" : "en-US"
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {detail ? (
          <>
            <SheetHeader className="border-b border-[var(--border-subtle)] px-6 py-6">
              <SheetTitle>{detail.item.asset.name}</SheetTitle>
              <SheetDescription>
                {detail.item.asset.symbol ?? t("assets.card.noSymbol")} ·{" "}
                {detail.item.asset.asset_type_code}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-8 p-6">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {t(`assets.workspace.ownership.${detail.item.ownership}`)}
                </Badge>
                <Badge variant="outline">
                  {t(
                    detail.item.lifecycle === "active"
                      ? "assets.card.active"
                      : "assets.card.archived"
                  )}
                </Badge>
                <Badge variant="ghost">
                  {t(
                    detail.item.origin === "global"
                      ? "assets.card.global"
                      : "assets.card.custom"
                  )}
                </Badge>
              </div>
              <dl className="grid grid-cols-2 gap-5">
                <Definition
                  label={t("assets.table.currency")}
                  value={detail.item.asset.currency_code}
                />
                <Definition
                  label={t("assets.table.exchange")}
                  value={
                    detail.item.asset.exchange ?? t("assets.card.noExchange")
                  }
                />
                <Definition
                  label={t("assets.relationships.currentPrice")}
                  value={formatPortfolioAmount(
                    detail.item.currentPrice,
                    detail.item.priceCurrency ??
                      detail.item.asset.currency_code,
                    locale
                  )}
                />
                <Definition
                  label={t("assets.workspace.dataStatus")}
                  value={t(`assets.workspace.data.${detail.item.dataStatus}`)}
                />
              </dl>
              <div className="flex flex-wrap gap-2">
                <Link
                  className={buttonVariants({ variant: "outline" })}
                  to="/portfolio"
                >
                  {t("assets.detail.viewPortfolio")}
                </Link>
                <Link
                  className={buttonVariants({ variant: "outline" })}
                  to={`/market-prices?assetId=${encodeURIComponent(detail.item.asset.id)}`}
                >
                  {t("assets.quality.resolvePrice")}
                </Link>
                <Button
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("tharwati:add-investment")
                    )
                  }
                >
                  {t("investment.primaryAction")}
                </Button>
                {detail.item.origin === "custom" ? (
                  <>
                    <Button variant="outline" onClick={onEdit}>
                      {t("assets.actions.edit")}
                    </Button>
                    {detail.item.lifecycle === "active" ? (
                      <Button variant="outline" onClick={onArchive}>
                        {t("assets.actions.archive")}
                      </Button>
                    ) : null}
                    {detail.item.referenceCount === 0 ? (
                      <Button variant="destructive" onClick={onDelete}>
                        {t("assets.actions.delete")}
                      </Button>
                    ) : null}
                  </>
                ) : null}
              </div>
              <section>
                <h3 className="text-sm font-semibold">
                  {t("assets.relationships.title")}
                </h3>
                <div className="mt-3 divide-y divide-[var(--border-subtle)]">
                  {detail.relationships.map((item) => (
                    <button
                      key={item.holdingId}
                      type="button"
                      onClick={() => onAccountScope(item.accountId)}
                      className="flex w-full justify-between gap-4 py-3 text-start focus-visible:ring-2"
                    >
                      <span>
                        {item.accountName}
                      </span>
                      <span className="tabular-nums" dir="ltr">
                        {formatPortfolioDecimal(item.quantity, locale, 10)}{" "}
                        {portfolioQuantityUnitLabel(item.unit, t)}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <h3 className="text-sm font-semibold">
                  {t("assets.activity.title")}
                </h3>
                <div className="mt-3 divide-y divide-[var(--border-subtle)]">
                  {detail.activity.slice(0, 6).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onOpenActivity(item.id)}
                      className="flex w-full justify-between gap-4 py-3 text-start focus-visible:ring-2"
                    >
                      <span>{item.description}</span>
                      <span className="tabular-nums" dir="ltr">
                        {formatPortfolioAmount(
                          item.originalAmount,
                          item.originalCurrency,
                          locale
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

export function HoldingEvidencePanel({
  holding,
  open,
  onOpenChange,
}: {
  holding: AssetRelationshipEvidence | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t, language } = useTranslation()
  const locale = language === "ar" ? "ar-SA" : "en-US"
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {holding ? (
          <>
            <SheetHeader className="border-b border-[var(--border-subtle)] px-6 py-6">
              <SheetTitle>
                {t("assets.relationships.positionEvidence")}
              </SheetTitle>
              <SheetDescription>{holding.accountName}</SheetDescription>
            </SheetHeader>
            <dl className="grid grid-cols-2 gap-5 p-6">
              <Definition
                label={t("assets.relationships.quantity")}
                value={`${formatPortfolioDecimal(holding.quantity, locale, 10)} ${portfolioQuantityUnitLabel(holding.unit, t)}`}
              />
              <Definition
                label={t("assets.relationships.averageCost")}
                value={formatPortfolioAmount(
                  holding.averageCost,
                  holding.costCurrency,
                  locale
                )}
              />
              <Definition
                label={t("assets.relationships.totalCost")}
                value={formatPortfolioAmount(
                  holding.totalCostBasis,
                  holding.costCurrency,
                  locale
                )}
              />
              <Definition
                label={t("assets.relationships.marketValue")}
                value={formatPortfolioAmount(
                  holding.marketValueBase,
                  holding.baseCurrency,
                  locale
                )}
              />
            </dl>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

export function ActivityEvidencePanel({
  activity,
  open,
  onOpenChange,
  onEditInvestment,
}: {
  activity: AssetActivityEvidence | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEditInvestment: (transactionId: string) => void
}) {
  const { t, language } = useTranslation()
  const locale = language === "ar" ? "ar-SA" : "en-US"
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {activity ? (
          <>
            <SheetHeader className="border-b border-[var(--border-subtle)] px-6 py-6">
              <SheetTitle>{activity.description}</SheetTitle>
              <SheetDescription>
                {activity.type} · {t("portfolio.activity.posted")}
              </SheetDescription>
            </SheetHeader>
            <div className="p-6">
              {activity.type === "buy" ? (
                <div className="mb-6">
                  <Button onClick={() => onEditInvestment(activity.id)}>
                    {t("investment.edit.action")}
                  </Button>
                </div>
              ) : null}
              <Definition
                label={t("portfolio.activity.amount")}
                value={formatPortfolioAmount(
                  activity.originalAmount,
                  activity.originalCurrency,
                  locale
                )}
              />
              <h3 className="text-muted-foreground mt-8 text-xs tracking-[0.1em] uppercase">
                {t("portfolio.activity.entries")}
              </h3>
              <ul className="mt-3 divide-y divide-[var(--border-subtle)]">
                {activity.entries.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex justify-between gap-4 py-3"
                  >
                    <span>
                      {entry.assetName}
                      <small className="text-muted-foreground block">
                        {entry.accountName}
                      </small>
                    </span>
                    <span className="tabular-nums" dir="ltr">
                      {formatPortfolioAmount(
                        entry.transactionAmount,
                        activity.originalCurrency,
                        locale
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
