import { useTranslation } from "../../../i18n/useTranslation"
import { getAssetTypeLabel } from "../../assets/types/asset-form"
import type { HoldingView } from "../types/holding-view"
import { getHoldingUnit } from "../types/holding"
import {
  formatCostAmount,
  formatHoldingQuantity,
} from "../utils/holding-formatters"

type Props = {
  view: HoldingView
  mobile?: boolean
}

export function HoldingRow({ view, mobile = false }: Props) {
  const { holding, financials } = view
  const { language, t } = useTranslation()
  const locale = language === "ar" ? "ar-SA" : "en-US"
  const unitCode = getHoldingUnit(holding)
  const unit = t(`holdings.unit.${unitCode}`)
  const quantity = formatHoldingQuantity(
    financials.quantity,
    unitCode,
    locale,
  )
  const averageCost = formatCostAmount(
    financials.averageCost,
    financials.costCurrencyCode,
    locale,
  )
  const totalCost = formatCostAmount(
    financials.totalCostBasis,
    financials.costCurrencyCode,
    locale,
  )

  if (mobile) {
    return (
      <article className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-bold">{holding.asset.name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {holding.asset.symbol ? (
                <span
                  className="text-sm text-[var(--color-text-secondary)]"
                  dir="ltr"
                >
                  {holding.asset.symbol}
                </span>
              ) : null}
              <span className="rounded-full bg-[var(--color-primary-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--color-primary)]">
                {getAssetTypeLabel(
                  holding.asset.asset_type_code,
                  t,
                )}
              </span>
            </div>
          </div>
          <div className="text-end">
            <p className="font-bold" dir="ltr">{quantity}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {unit}
            </p>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs text-[var(--color-text-secondary)]">
              {t("holdings.table.account")}
            </dt>
            <dd className="mt-1 font-semibold">{holding.account.name}</dd>
          </div>
          <div className="text-end">
            <dt className="text-xs text-[var(--color-text-secondary)]">
              {t("holdings.table.averageCost")}
            </dt>
            <dd className="mt-1 font-semibold" dir="ltr">
              {averageCost}
            </dd>
          </div>
          <div className="col-span-2 border-t border-[var(--color-border)] pt-3 text-end">
            <dt className="text-xs text-[var(--color-text-secondary)]">
              {t("holdings.table.totalCost")}
            </dt>
            <dd className="mt-1 text-base font-black" dir="ltr">
              {totalCost}
            </dd>
          </div>
        </dl>
      </article>
    )
  }

  return (
    <tr className="hover:bg-[var(--color-surface-hover)]">
      <td className="px-4 py-3">
        <p className="font-semibold">{holding.asset.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {holding.asset.symbol ? (
            <span
              className="text-xs text-[var(--color-text-secondary)]"
              dir="ltr"
            >
              {holding.asset.symbol}
            </span>
          ) : null}
          <span className="rounded-full bg-[var(--color-primary-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-primary)]">
            {getAssetTypeLabel(holding.asset.asset_type_code, t)}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 font-semibold">{holding.account.name}</td>
      <td className="px-4 py-3">
        <p className="font-semibold" dir="ltr">{quantity}</p>
        <p className="text-xs text-[var(--color-text-secondary)]">
          {unit}
        </p>
      </td>
      <td className="px-4 py-3 font-semibold" dir="ltr">
        {averageCost}
      </td>
      <td className="px-4 py-3 font-bold" dir="ltr">
        {totalCost}
      </td>
    </tr>
  )
}

