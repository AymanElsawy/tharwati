import { ArrowUpDown, MoreHorizontal, Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AssetDataStatus,
  AssetOwnershipStatus,
} from "@/features/assets/components/AssetOwnershipStatus"
import type {
  AssetInventoryItem,
  AssetInventorySort,
} from "@/features/assets/types/asset-workspace"
import { getAssetTypeLabel } from "@/features/assets/types/asset-form"
import type { TranslationKey } from "@/i18n/en/translations"
import { useTranslation } from "@/i18n/useTranslation"

const columns: Array<[AssetInventorySort, TranslationKey]> = [
  ["name", "assets.table.name"],
  ["ownership", "assets.workspace.ownershipLabel"],
  ["asset_class", "assets.table.type"],
  ["currency", "assets.table.currency"],
  ["price_date", "assets.workspace.priceDate"],
  ["data_status", "assets.workspace.dataStatus"],
]

export function AssetInventory({
  items,
  selectedAssetId,
  sort,
  direction,
  onSort,
  onSelect,
  onManagePrice,
}: {
  items: AssetInventoryItem[]
  selectedAssetId: string | null
  sort: AssetInventorySort
  direction: "asc" | "desc"
  onSort: (sort: AssetInventorySort) => void
  onSelect: (id: string) => void
  onManagePrice: (item: AssetInventoryItem) => void
}) {
  const { t, language } = useTranslation()
  const locale = language === "ar" ? "ar-SA" : "en-US"
  const openInvestment = () =>
    window.dispatchEvent(new CustomEvent("tharwati:add-investment"))
  return (
    <section aria-labelledby="asset-inventory-title" className="mt-10">
      <header>
        <p className="tharwati-eyebrow">
          {t("assets.workspace.inventoryEyebrow")}
        </p>
        <h2 id="asset-inventory-title" tabIndex={-1} className="tharwati-section-title mt-2 outline-none">
          {t("assets.workspace.inventoryTitle")}
        </h2>
      </header>
      <div className="mt-5 hidden max-h-[44rem] overflow-auto lg:block">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="bg-background sticky top-0 z-10">
            <tr className="border-y border-[var(--border-subtle)]">
              {columns.map(([id, key]) => (
                <th
                  key={id}
                  scope="col"
                  aria-sort={
                    sort === id
                      ? direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  className="text-muted-foreground px-3 py-3 text-start text-xs font-medium tracking-[0.1em] uppercase"
                >
                  <button
                    type="button"
                    onClick={() => onSort(id)}
                    className="inline-flex items-center gap-1 rounded-sm focus-visible:ring-2"
                  >
                    {t(key)}
                    <ArrowUpDown size={13} aria-hidden="true" />
                  </button>
                </th>
              ))}
              <th className="text-muted-foreground px-3 py-3 text-start text-xs tracking-[0.1em] uppercase">
                {t("assets.workspace.originLabel")}
              </th>
              <th className="text-muted-foreground px-3 py-3 text-start text-xs tracking-[0.1em] uppercase">
                {t("assets.table.status")}
              </th>
              <th className="px-3 py-3 text-end">
                <span className="sr-only">{t("assets.table.actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.asset.id}
                aria-selected={selectedAssetId === item.asset.id}
                className="hover:bg-muted/30 aria-selected:bg-muted/50 border-b border-[var(--border-subtle)] transition-colors motion-reduce:transition-none"
              >
                <td className="px-3 py-4">
                  <button
                    type="button"
                    onClick={() => onSelect(item.asset.id)}
                    className="max-w-64 text-start font-medium focus-visible:ring-2"
                  >
                    {item.asset.name}
                    <span
                      className="text-muted-foreground mt-1 block text-xs font-normal"
                      dir="ltr"
                    >
                      {item.asset.symbol ?? t("assets.card.noSymbol")}
                      {item.asset.exchange ? ` · ${item.asset.exchange}` : ""}
                    </span>
                  </button>
                </td>
                <td className="px-3 py-4">
                  <AssetOwnershipStatus item={item} />
                </td>
                <td className="px-3 py-4">
                  {getAssetTypeLabel(item.asset.asset_type_code, t)}
                </td>
                <td className="px-3 py-4 tabular-nums" dir="ltr">
                  {item.asset.currency_code}
                </td>
                <td className="text-muted-foreground px-3 py-4 text-xs">
                  {item.priceTimestamp
                    ? new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium",
                      }).format(new Date(item.priceTimestamp))
                    : "—"}
                </td>
                <td className="px-3 py-4">
                  {item.dataStatus === "missing_price" || item.dataStatus === "stale" ? <button type="button" onClick={() => onManagePrice(item)} className="rounded-sm focus-visible:ring-2"><AssetDataStatus item={item} /></button> : <AssetDataStatus item={item} />}
                </td>
                <td className="px-3 py-4">
                  <Badge variant="outline">
                    {t(
                      item.origin === "global"
                        ? "assets.card.global"
                        : "assets.card.custom"
                    )}
                  </Badge>
                </td>
                <td className="px-3 py-4">
                  <Badge
                    variant={item.lifecycle === "active" ? "ghost" : "outline"}
                  >
                    {t(
                      item.lifecycle === "active"
                        ? "assets.card.active"
                        : "assets.card.archived"
                    )}
                  </Badge>
                </td>
                <td className="px-3 py-4 text-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="rounded-lg p-2 focus-visible:ring-2"
                      aria-label={t("assets.workspace.actionsFor", {
                        name: item.asset.name,
                      })}
                    >
                      <MoreHorizontal size={17} />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={openInvestment}>
                        <Plus size={14} />
                        {t("investment.primaryAction")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-5 divide-y divide-[var(--border-subtle)] lg:hidden">
        {items.map((item) => (
          <article
            key={item.asset.id}
            aria-selected={selectedAssetId === item.asset.id}
            className="aria-selected:bg-muted/40 py-5"
          >
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                onClick={() => onSelect(item.asset.id)}
                className="min-w-0 text-start focus-visible:ring-2"
              >
                <strong className="block truncate font-medium">
                  {item.asset.name}
                </strong>
                <span
                  className="text-muted-foreground mt-1 block text-xs"
                  dir="ltr"
                >
                  {item.asset.symbol ??
                    getAssetTypeLabel(item.asset.asset_type_code, t)}{" "}
                  · {item.asset.currency_code}
                </span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="rounded-lg p-2 focus-visible:ring-2"
                  aria-label={t("assets.workspace.actionsFor", {
                    name: item.asset.name,
                  })}
                >
                  <MoreHorizontal size={17} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={openInvestment}>
                    <Plus size={14} />
                    {t("investment.primaryAction")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <AssetOwnershipStatus item={item} />
              <Badge variant="outline">
                {t(
                  item.lifecycle === "active"
                    ? "assets.card.active"
                    : "assets.card.archived"
                )}
              </Badge>
              <Badge variant="ghost">
                {t(
                  item.origin === "global"
                    ? "assets.card.global"
                    : "assets.card.custom"
                )}
              </Badge>
            </div>
            <div className="text-muted-foreground mt-3 flex items-center justify-between gap-3 text-xs">
              <span>
                {getAssetTypeLabel(item.asset.asset_type_code, t)} ·{" "}
                {t("assets.workspace.accounts", {
                  count: item.accounts.length,
                })}
              </span>
              {item.dataStatus === "missing_price" || item.dataStatus === "stale" ? <button type="button" onClick={() => onManagePrice(item)} className="rounded-sm focus-visible:ring-2"><AssetDataStatus item={item} /></button> : <AssetDataStatus item={item} />}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
