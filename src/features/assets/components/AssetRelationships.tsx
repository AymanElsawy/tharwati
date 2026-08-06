import { ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { AssetRelationshipEvidence } from "@/features/assets/types/asset-workspace"
import {
  formatPortfolioAmount,
  formatPortfolioDecimal,
} from "@/features/portfolio/utils/portfolio-formatters"
import { portfolioQuantityUnitLabel } from "@/features/portfolio/utils/portfolio-labels"
import { useTranslation } from "@/i18n/useTranslation"

export function AssetRelationships({
  relationships,
  accounts,
  selectedAsset,
  accountId,
  onAccountFilter,
  onOpenHolding,
}: {
  relationships: AssetRelationshipEvidence[]
  accounts: Array<{ id: string; name: string }>
  selectedAsset: boolean
  accountId: string | null
  onAccountFilter: (id: string | null) => void
  onOpenHolding: (id: string) => void
}) {
  const { t, language } = useTranslation()
  const locale = language === "ar" ? "ar-SA" : "en-US"
  return (
    <section aria-labelledby="asset-relationships-title" className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="tharwati-eyebrow">
            {t("assets.relationships.eyebrow")}
          </p>
          <h2
            id="asset-relationships-title"
            className="tharwati-section-title mt-2"
          >
            {t("assets.relationships.title")}
          </h2>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
            {t("assets.relationships.description")}
          </p>
        </div>
        <label className="text-muted-foreground text-xs">
          {t("assets.relationships.filterAccount")}
          <select
            value={accountId ?? ""}
            onChange={(event) => onAccountFilter(event.target.value || null)}
            className="bg-background text-foreground ms-2 rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
          >
            <option value="">{t("portfolio.activity.allTypes")}</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {relationships.length === 0 ? (
        <p className="text-muted-foreground mt-6 border-y border-[var(--border-subtle)] py-7 text-sm">
          {t(
            selectedAsset
              ? "assets.relationships.noSelected"
              : "assets.relationships.empty"
          )}
        </p>
      ) : (
        <>
          <div className="mt-5 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[850px] text-sm">
              <thead>
                <tr className="text-muted-foreground border-y border-[var(--border-subtle)] text-xs tracking-[0.1em] uppercase">
                  <th className="px-3 py-3 text-start">
                    {t("assets.relationships.account")}
                  </th>
                  <th className="px-3 py-3 text-end">
                    {t("assets.relationships.quantity")}
                  </th>
                  <th className="px-3 py-3 text-end">
                    {t("assets.relationships.averageCost")}
                  </th>
                  <th className="px-3 py-3 text-end">
                    {t("assets.relationships.totalCost")}
                  </th>
                  <th className="px-3 py-3 text-end">
                    {t("assets.relationships.marketValue")}
                  </th>
                  <th>
                    <span className="sr-only">{t("assets.table.actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {relationships.map((item) => (
                  <tr
                    key={item.holdingId}
                    className="border-b border-[var(--border-subtle)]"
                  >
                    <td className="px-3 py-4">
                      <button
                        className="text-start font-medium focus-visible:ring-2"
                        onClick={() => onAccountFilter(item.accountId)}
                      >
                        {item.accountName}
                      </button>
                    </td>
                    <td className="px-3 py-4 text-end tabular-nums" dir="ltr">
                      {formatPortfolioDecimal(item.quantity, locale, 10)}{" "}
                      {portfolioQuantityUnitLabel(item.unit, t)}
                    </td>
                    <td className="px-3 py-4 text-end tabular-nums" dir="ltr">
                      {formatPortfolioAmount(
                        item.averageCost,
                        item.costCurrency,
                        locale
                      )}
                    </td>
                    <td className="px-3 py-4 text-end tabular-nums" dir="ltr">
                      {formatPortfolioAmount(
                        item.totalCostBasis,
                        item.costCurrency,
                        locale
                      )}
                    </td>
                    <td className="px-3 py-4 text-end tabular-nums" dir="ltr">
                      {formatPortfolioAmount(
                        item.marketValueBase,
                        item.baseCurrency,
                        locale
                      )}
                    </td>
                    <td className="px-3 py-4 text-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("assets.relationships.openHolding")}
                        onClick={() => onOpenHolding(item.holdingId)}
                      >
                        <ExternalLink size={15} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5 divide-y divide-[var(--border-subtle)] md:hidden">
            {relationships.map((item) => (
              <button
                key={item.holdingId}
                type="button"
                onClick={() => onOpenHolding(item.holdingId)}
                className="grid w-full grid-cols-[1fr_auto] gap-3 py-5 text-start focus-visible:ring-2"
              >
                <span>
                  <strong className="block">{item.accountName}</strong>
                  <span className="text-muted-foreground mt-1 block text-xs">
                    {formatPortfolioDecimal(item.quantity, locale, 10)}{" "}
                    {portfolioQuantityUnitLabel(item.unit, t)}
                  </span>
                </span>
                <span className="text-end tabular-nums">
                  <strong className="block">
                    {formatPortfolioAmount(
                      item.totalCostBasis,
                      item.costCurrency,
                      locale
                    )}
                  </strong>
                  <span className="text-muted-foreground mt-1 block text-xs">
                    {formatPortfolioAmount(
                      item.marketValueBase,
                      item.baseCurrency,
                      locale
                    )}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
