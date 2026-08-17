import {
  ArrowUpDown,
  Archive,
  ArchiveRestore,
  Coins,
  Pencil,
  Trash2,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  getAccountTypeLabel,
  metalTypeOptions,
} from "@/features/accounts/types/account-form"
import {
  formatPortfolioAmount,
  formatPortfolioDecimal,
  formatPortfolioPercent,
} from "@/features/portfolio/utils/portfolio-formatters"
import type { AccountSummary } from "@/lib/supabase/types"
import type { TranslationKey } from "@/i18n/en/translations"
import { useTranslation } from "@/i18n/useTranslation"

export type AccountInventorySort =
  "name" | "type" | "currency" | "balance" | "status"

export type AccountInventoryItem = {
  account: AccountSummary
  currentBalance: string | null
}

const columns: Array<[AccountInventorySort, TranslationKey]> = [
  ["name", "accounts.table.name"],
  ["type", "accounts.table.type"],
  ["currency", "accounts.table.currency"],
  ["balance", "accounts.table.balance"],
  ["status", "accounts.table.status"],
]

function typeLabel(
  account: AccountSummary,
  t: ReturnType<typeof useTranslation>["t"]
) {
  if (account.account_type_code === "gold" && account.metal_type) {
    const option = metalTypeOptions.find(
      (item) => item.value === account.metal_type
    )
    if (option) return t(option.labelKey)
  }
  return getAccountTypeLabel(account.account_type_code, t)
}

function balanceCell(item: AccountInventoryItem, locale: string) {
  if (item.account.account_type_code === "gold") {
    return item.account.balance_grams === null
      ? "—"
      : `${formatPortfolioDecimal(item.account.balance_grams, locale, 3)} g`
  }
  return item.currentBalance === null
    ? "—"
    : formatPortfolioAmount(
        item.currentBalance,
        item.account.currency_code,
        locale
      )
}

export function AccountInventory({
  items,
  sort,
  direction,
  onSort,
  onEdit,
  onArchive,
  onDelete,
  onAddMetalPurchase,
  canDelete,
}: {
  items: AccountInventoryItem[]
  sort: AccountInventorySort
  direction: "asc" | "desc"
  onSort: (sort: AccountInventorySort) => void
  onEdit: (account: AccountSummary) => void
  onArchive: (account: AccountSummary) => void
  onDelete: (account: AccountSummary) => void
  onAddMetalPurchase: (account: AccountSummary) => void
  canDelete: (accountId: string) => boolean
}) {
  const { t, language } = useTranslation()
  const locale = language === "ar" ? "ar-SA" : "en-US"

  return (
    <section aria-labelledby="account-inventory-title" className="mt-8">
      <div className="mt-2 hidden max-h-[44rem] overflow-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm lg:block">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--color-surface-muted)]">
            <tr className="border-b border-[var(--color-border)]">
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
                  className="px-4 py-3 text-start text-xs font-medium tracking-[0.1em] text-muted-foreground uppercase"
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
              <th className="px-4 py-3 text-start text-xs tracking-[0.1em] text-muted-foreground uppercase">
                {t("accounts.table.ownership")}
              </th>
              <th className="px-4 py-3 text-end text-xs tracking-[0.1em] text-muted-foreground uppercase">
                {t("accounts.table.actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.account.id}
                className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-surface-hover)]"
              >
                <td className="px-4 py-4 font-medium">{item.account.name}</td>
                <td className="px-4 py-4">{typeLabel(item.account, t)}</td>
                <td className="px-4 py-4" dir="ltr">
                  {item.account.currency_code}
                </td>
                <td className="px-4 py-4 tabular-nums" dir="ltr">
                  {balanceCell(item, locale)}
                </td>
                <td className="px-4 py-4">
                  <Badge variant={item.account.is_active ? "ghost" : "outline"}>
                    {t(
                      item.account.is_active
                        ? "accounts.card.active"
                        : "accounts.card.archived"
                    )}
                  </Badge>
                </td>
                <td className="px-4 py-4 tabular-nums" dir="ltr">
                  {item.account.ownership_percentage === null
                    ? "—"
                    : formatPortfolioPercent(
                        item.account.ownership_percentage,
                        locale
                      )}
                </td>
                <td className="px-4 py-4">
                  <div className="flex justify-end gap-1">
                    {item.account.account_type_code === "gold" &&
                    item.account.is_active ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("accounts.metalPurchase.addFor", {
                          name: item.account.name,
                        })}
                        onClick={() => onAddMetalPurchase(item.account)}
                      >
                        <Coins size={15} />
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("accounts.table.editLabel", {
                        name: item.account.name,
                      })}
                      onClick={() => onEdit(item.account)}
                    >
                      <Pencil size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("accounts.table.archiveLabel", {
                        name: item.account.name,
                      })}
                      onClick={() => onArchive(item.account)}
                    >
                      {item.account.is_active ? (
                        <Archive size={15} />
                      ) : (
                        <ArchiveRestore size={15} />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={!canDelete(item.account.id)}
                      aria-label={t("accounts.table.deleteLabel", {
                        name: item.account.name,
                      })}
                      onClick={() => onDelete(item.account)}
                      className="text-red-600 hover:text-red-700 disabled:text-muted-foreground dark:text-red-400"
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 divide-y divide-[var(--color-border)] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm lg:hidden">
        {items.map((item) => (
          <div key={item.account.id} className="grid gap-3 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <span>
                <strong className="block">{item.account.name}</strong>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {typeLabel(item.account, t)} · {item.account.currency_code}
                </span>
              </span>
              <Badge variant={item.account.is_active ? "ghost" : "outline"}>
                {t(
                  item.account.is_active
                    ? "accounts.card.active"
                    : "accounts.card.archived"
                )}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <strong className="tabular-nums" dir="ltr">
                {balanceCell(item, locale)}
              </strong>
              <div className="flex gap-1">
                {item.account.account_type_code === "gold" &&
                item.account.is_active ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("accounts.metalPurchase.addFor", {
                      name: item.account.name,
                    })}
                    onClick={() => onAddMetalPurchase(item.account)}
                  >
                    <Coins size={15} />
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("accounts.table.editLabel", {
                    name: item.account.name,
                  })}
                  onClick={() => onEdit(item.account)}
                >
                  <Pencil size={15} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("accounts.table.archiveLabel", {
                    name: item.account.name,
                  })}
                  onClick={() => onArchive(item.account)}
                >
                  {item.account.is_active ? (
                    <Archive size={15} />
                  ) : (
                    <ArchiveRestore size={15} />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!canDelete(item.account.id)}
                  aria-label={t("accounts.table.deleteLabel", {
                    name: item.account.name,
                  })}
                  onClick={() => onDelete(item.account)}
                  className="text-red-600 hover:text-red-700 disabled:text-muted-foreground dark:text-red-400"
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
