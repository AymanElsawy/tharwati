import { ArrowUpDown } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type {
  AccountInventoryItem,
  AccountInventorySort,
} from "@/features/accounts/types/account-workspace"
import { getAccountTypeLabel } from "@/features/accounts/types/account-form"
import { formatPortfolioAmount } from "@/features/portfolio/utils/portfolio-formatters"
import type { TranslationKey } from "@/i18n/en/translations"
import { useTranslation } from "@/i18n/useTranslation"

const columns: Array<[AccountInventorySort, TranslationKey]> = [
  ["name", "accounts.table.name"],
  ["type", "accounts.card.type"],
  ["currency", "accounts.card.currency"],
  ["balance", "accounts.workspace.currentBalance"],
  ["status", "accounts.card.status"],
  ["activity", "accounts.workspace.lastActivity"],
]

export function AccountInventory({
  items,
  selectedId,
  sort,
  direction,
  onSort,
  onSelect,
}: {
  items: AccountInventoryItem[]
  selectedId: string | null
  sort: AccountInventorySort
  direction: "asc" | "desc"
  onSort: (sort: AccountInventorySort) => void
  onSelect: (id: string) => void
}) {
  const { t, language } = useTranslation()
  const locale = language === "ar" ? "ar-SA" : "en-US"
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" })
  const value = (item: AccountInventoryItem) =>
    item.currentBalance === null
      ? "—"
      : formatPortfolioAmount(
          item.currentBalance,
          item.account.currency_code,
          locale
        )
  return (
    <section aria-labelledby="account-inventory-title" className="mt-10">
      <header>
        <p className="tharwati-eyebrow">
          {t("accounts.workspace.inventoryEyebrow")}
        </p>
        <h2
          id="account-inventory-title"
          className="tharwati-section-title mt-2"
        >
          {t("accounts.workspace.inventoryTitle")}
        </h2>
      </header>
      <div className="mt-5 hidden max-h-[44rem] overflow-auto lg:block">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-background sticky top-0 z-10">
            <tr className="border-y border-[var(--border-subtle)]">
              {columns.map(([id, label]) => (
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
                    className="inline-flex items-center gap-1 focus-visible:ring-2"
                  >
                    {t(label)}
                    <ArrowUpDown size={13} />
                  </button>
                </th>
              ))}
              <th className="text-muted-foreground px-3 py-3 text-start text-xs tracking-[0.1em] uppercase">
                {t("accounts.workspace.holdings")}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.account.id}
                aria-selected={selectedId === item.account.id}
                className="hover:bg-muted/30 aria-selected:bg-muted/50 border-b border-[var(--border-subtle)]"
              >
                <td className="px-3 py-4">
                  <button
                    type="button"
                    onClick={() => onSelect(item.account.id)}
                    className="text-start font-medium focus-visible:ring-2"
                  >
                    {item.account.name}
                    <span className="text-muted-foreground mt-1 block text-xs font-normal">
                      {t("accounts.workspace.userOwned")}
                    </span>
                  </button>
                </td>
                <td className="px-3 py-4">
                  {getAccountTypeLabel(item.account.account_type_code, t)}
                </td>
                <td className="px-3 py-4" dir="ltr">
                  {item.account.currency_code}
                </td>
                <td className="px-3 py-4 tabular-nums" dir="ltr">
                  {value(item)}
                  {item.projectedCash !== null ? (
                    <span className="text-muted-foreground mt-1 block text-xs">
                      {t("accounts.workspace.projectedCash")}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-4">
                  <Badge variant={item.account.is_active ? "ghost" : "outline"}>
                    {t(
                      item.account.is_active
                        ? "assets.card.active"
                        : "assets.card.archived"
                    )}
                  </Badge>
                </td>
                <td className="text-muted-foreground px-3 py-4 text-xs">
                  {item.lastActivityAt
                    ? date.format(new Date(item.lastActivityAt))
                    : "—"}
                </td>
                <td className="px-3 py-4 tabular-nums">
                  {item.linkedHoldingsCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-5 divide-y divide-[var(--border-subtle)] lg:hidden">
        {items.map((item) => (
          <button
            key={item.account.id}
            type="button"
            aria-pressed={selectedId === item.account.id}
            onClick={() => onSelect(item.account.id)}
            className="grid w-full grid-cols-[1fr_auto] gap-4 py-5 text-start focus-visible:ring-2"
          >
            <span>
              <strong className="block">{item.account.name}</strong>
              <span className="text-muted-foreground mt-1 block text-xs">
                {getAccountTypeLabel(item.account.account_type_code, t)}{" "}
                · {item.account.currency_code}
              </span>
              <span className="mt-3 flex gap-2">
                <Badge variant="outline">
                  {t("accounts.workspace.userOwned")}
                </Badge>
                <Badge variant="ghost">
                  {t(
                    item.account.is_active
                      ? "assets.card.active"
                      : "assets.card.archived"
                  )}
                </Badge>
              </span>
            </span>
            <span className="text-end tabular-nums">
              <strong className="block" dir="ltr">
                {value(item)}
              </strong>
              <span className="text-muted-foreground mt-1 block text-xs">
                {t("accounts.workspace.holdingsCount", {
                  count: item.linkedHoldingsCount,
                })}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
