import type { ReactNode } from "react"
import {
  ArrowUpDown,
  Archive,
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  Coins,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getAccountDisplayTypeLabel } from "@/features/accounts/utils/account-display-label"
import {
  formatPortfolioAmount,
  formatPortfolioPercent,
} from "@/features/portfolio/utils/portfolio-formatters"
import type { AccountSummary } from "@/lib/supabase/types"
import type { TranslationKey } from "@/i18n/en/translations"
import { useTranslation } from "@/i18n/useTranslation"
import { isSoldAccount } from "@/features/accounts/utils/account-lifecycle"
import { accountTypeVisuals } from "@/features/accounts/types/account-visuals"
import type { AccountTypeCode } from "@/features/accounts/types/account-form"
import { stopCardNavigation } from "./account-inventory-interactions"

function ActionButton({
  ariaLabel,
  tooltip,
  onClick,
  disabled,
  className,
  children,
}: {
  ariaLabel: string
  tooltip: string
  onClick: () => void
  disabled?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            disabled={disabled}
            aria-label={ariaLabel}
            onClick={(event) => {
              event.stopPropagation()
              onClick()
            }}
            className={className}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

export type AccountInventorySort = "name" | "type" | "balance"

export type AccountInventoryItem = {
  account: AccountSummary
  currentBalance: string | null
  metalCurrentValue: string | null
  currentValueStatus: "complete" | "incomplete"
  isCurrentValueLoading: boolean
}

const columns: Array<[AccountInventorySort, TranslationKey]> = [
  ["name", "accounts.table.name"],
  ["type", "accounts.table.type"],
  ["balance", "accounts.table.balance"],
]

function balanceCell(
  item: AccountInventoryItem,
  locale: string,
  unavailableLabel: string,
  loadingLabel: string
) {
  if (item.isCurrentValueLoading) {
    return (
      <span
        aria-label={loadingLabel}
        className="inline-block h-4 w-24 animate-pulse rounded bg-muted"
      />
    )
  }

  const value =
    item.account.account_type_code === "gold"
      ? item.metalCurrentValue
      : item.currentBalance
  if (value === null || item.currentValueStatus === "incomplete") {
    return unavailableLabel
  }

  return formatPortfolioAmount(value, item.account.currency_code, locale)
}

export function AccountInventory({
  sectionTitle,
  items,
  sort,
  direction,
  onSort,
  onEdit,
  onLifecycle,
  onDelete,
  onAddMetalPurchase,
  onOpenAccount,
  canDelete,
}: {
  sectionTitle?: string
  items: AccountInventoryItem[]
  sort: AccountInventorySort
  direction: "asc" | "desc"
  onSort: (sort: AccountInventorySort) => void
  onEdit: (account: AccountSummary) => void
  onLifecycle: (account: AccountSummary) => void
  onDelete: (account: AccountSummary) => void
  onAddMetalPurchase: (account: AccountSummary) => void
  onOpenAccount: (account: AccountSummary) => void
  canDelete: (accountId: string) => boolean
}) {
  const { t, language } = useTranslation()
  const locale = language === "ar" ? "ar-SA" : "en-US"

  return (
    <section aria-labelledby="account-inventory-title" className="mt-5 sm:mt-8">
      {sectionTitle ? (
        <h2 className="font-heading mb-3 text-lg font-semibold text-[var(--color-text-primary)]">
          {sectionTitle}
        </h2>
      ) : null}
      <div className="mt-2 hidden max-h-[44rem] overflow-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] shadow-[0_10px_30px_rgba(15,23,42,0.06)] lg:block">
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
                  className="px-5 py-3.5 text-start text-[11px] font-bold tracking-[0.1em] text-muted-foreground uppercase"
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
              <th className="px-5 py-3.5 text-start text-[11px] font-bold tracking-[0.1em] text-muted-foreground uppercase">
                {t("accounts.table.ownership")}
              </th>
              <th className="px-5 py-3.5 text-end text-[11px] font-bold tracking-[0.1em] text-muted-foreground uppercase">
                {t("accounts.table.actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const sold = isSoldAccount(item.account)
              const inactive = !item.account.is_active
              return (
                <tr
                  key={item.account.id}
                  className={`cursor-pointer border-b border-[var(--color-border)] transition-colors last:border-b-0 hover:bg-[var(--color-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] ${inactive ? "bg-[var(--color-surface-muted)]/60 text-muted-foreground" : ""}`}
                  tabIndex={0}
                  onClick={() => onOpenAccount(item.account)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      onOpenAccount(item.account)
                    }
                  }}
                >
                  <td className="px-5 py-4.5 font-semibold">
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {item.account.name}
                      {sold ? (
                        <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--color-surface-muted)] px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                          {t("accounts.disposal.sold")}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-5 py-4.5 text-[var(--color-text-secondary)]">
                    {getAccountDisplayTypeLabel(item.account, t)}
                  </td>
                  <td
                    className="px-5 py-4.5 font-medium tabular-nums"
                    dir="ltr"
                  >
                    {balanceCell(
                      item,
                      locale,
                      t("accounts.currentValueUnavailable"),
                      t("common.loading")
                    )}
                  </td>
                  <td
                    className="px-5 py-4.5 text-[var(--color-text-secondary)] tabular-nums"
                    dir="ltr"
                  >
                    {item.account.ownership_percentage === null
                      ? "—"
                      : formatPortfolioPercent(
                          item.account.ownership_percentage,
                          locale
                        )}
                  </td>
                  <td className="px-5 py-4.5">
                    <div className="flex justify-end gap-1.5">
                      {item.account.account_type_code === "gold" &&
                      item.account.is_active ? (
                        <ActionButton
                          ariaLabel={t("accounts.metalPurchase.addFor", {
                            name: item.account.name,
                          })}
                          tooltip={t("accounts.metalPurchase.add")}
                          onClick={() => onAddMetalPurchase(item.account)}
                        >
                          <Coins size={15} />
                        </ActionButton>
                      ) : null}
                      {!sold ? (
                        <ActionButton
                          ariaLabel={t("accounts.table.editLabel", {
                            name: item.account.name,
                          })}
                          tooltip={t("accounts.actions.edit")}
                          onClick={() => onEdit(item.account)}
                        >
                          <Pencil size={15} />
                        </ActionButton>
                      ) : null}
                      {!sold ? (
                        <ActionButton
                          ariaLabel={t("accounts.table.closeLabel", {
                            name: item.account.name,
                          })}
                          tooltip={t(
                            item.account.is_active
                              ? "accounts.actions.close"
                              : "accounts.actions.reopen"
                          )}
                          onClick={() => onLifecycle(item.account)}
                        >
                          {item.account.is_active ? (
                            <Archive size={15} />
                          ) : (
                            <ArchiveRestore size={15} />
                          )}
                        </ActionButton>
                      ) : null}
                      <ActionButton
                        ariaLabel={t("accounts.table.deleteLabel", {
                          name: item.account.name,
                        })}
                        tooltip={t("accounts.actions.delete")}
                        disabled={!canDelete(item.account.id)}
                        onClick={() => onDelete(item.account)}
                        className="text-red-600 hover:text-red-700 disabled:text-muted-foreground dark:text-red-400"
                      >
                        <Trash2 size={15} />
                      </ActionButton>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 divide-y divide-[var(--color-border)] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] shadow-[0_8px_24px_rgba(15,23,42,0.05)] lg:hidden">
        {items.map((item) => {
          const sold = isSoldAccount(item.account)
          const inactive = !item.account.is_active
          const typeVisual =
            accountTypeVisuals[
              item.account.account_type_code as AccountTypeCode
            ]
          const TypeIcon = typeVisual.icon
          return (
            <div
              key={item.account.id}
              className={`relative rounded-xl px-3.5 py-3 transition-colors hover:bg-[var(--color-surface-hover)] ${inactive ? "bg-[var(--color-surface-muted)]/60 text-muted-foreground" : ""}`}
            >
              <button
                type="button"
                aria-label={t("accounts.table.openLabel", {
                  name: item.account.name,
                })}
                onClick={() => onOpenAccount(item.account)}
                className="absolute inset-0 z-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
              />
              <div className="pointer-events-none relative z-10 grid gap-2.5">
                <div className="flex items-start gap-2.5">
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${typeVisual.iconWrap}`}
                  >
                    <TypeIcon aria-hidden="true" size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <strong className="min-w-0 break-words">
                        {item.account.name}
                      </strong>
                      <span
                        className="flex max-w-[58%] shrink-0 items-start gap-1 text-end text-sm font-bold tabular-nums"
                        dir="ltr"
                      >
                        {language === "ar" ? (
                          <ChevronLeft
                            aria-hidden="true"
                            size={17}
                            className="mt-0.5 shrink-0 text-muted-foreground/70"
                          />
                        ) : null}
                        <span className="min-w-0 break-words">
                          {balanceCell(
                            item,
                            locale,
                            t("accounts.currentValueUnavailable"),
                            t("common.loading")
                          )}
                        </span>
                        {language === "ar" ? null : (
                          <ChevronRight
                            aria-hidden="true"
                            size={17}
                            className="mt-0.5 shrink-0 text-muted-foreground/70"
                          />
                        )}
                      </span>
                    </div>
                    <div className="mt-0.5 flex min-h-11 items-center justify-between gap-2">
                      <p className="min-w-0 text-xs text-muted-foreground">
                        {getAccountDisplayTypeLabel(item.account, t)}
                      </p>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label={t("accounts.card.actions", {
                            name: item.account.name,
                          })}
                          onClick={stopCardNavigation}
                          onPointerDown={stopCardNavigation}
                          onKeyDown={stopCardNavigation}
                          className="pointer-events-auto flex size-11 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                        >
                          <MoreHorizontal size={19} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="min-w-44 p-1.5 [&_[data-slot=dropdown-menu-item]]:min-h-11 [&_[data-slot=dropdown-menu-item]]:px-3"
                          onClick={stopCardNavigation}
                        >
                          {item.account.account_type_code === "gold" &&
                          item.account.is_active ? (
                            <DropdownMenuItem
                              onClick={() => onAddMetalPurchase(item.account)}
                            >
                              <Coins />
                              {t("accounts.metalPurchase.add")}
                            </DropdownMenuItem>
                          ) : null}
                          {!sold ? (
                            <DropdownMenuItem
                              onClick={() => onEdit(item.account)}
                            >
                              <Pencil />
                              {t("accounts.actions.edit")}
                            </DropdownMenuItem>
                          ) : null}
                          {!sold ? (
                            <DropdownMenuItem
                              onClick={() => onLifecycle(item.account)}
                            >
                              {item.account.is_active ? (
                                <Archive />
                              ) : (
                                <ArchiveRestore />
                              )}
                              {t(
                                item.account.is_active
                                  ? "accounts.actions.close"
                                  : "accounts.actions.reopen"
                              )}
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={!canDelete(item.account.id)}
                            onClick={() => onDelete(item.account)}
                          >
                            <Trash2 />
                            {t("accounts.actions.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                    <span
                      className={`size-1.5 rounded-full ${inactive ? "bg-muted-foreground/60" : "bg-emerald-500"}`}
                    />
                    {sold
                      ? t("accounts.disposal.sold")
                      : t(
                          inactive
                            ? "accounts.card.archived"
                            : "accounts.card.active"
                        )}
                    <span aria-hidden="true">·</span>
                    <span dir="ltr">{item.account.currency_code}</span>
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
