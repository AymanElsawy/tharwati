import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import {
  ArrowUpDown,
  Archive,
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  Coins,
  MoreHorizontal,
  GripVertical,
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
import type { AccountSort } from "@/features/accounts/utils/account-custom-order"
import { stopCardNavigation } from "./account-inventory-interactions"
import { AccountDragPreview, AccountInsertionGap } from "./AccountDragVisuals"
import { dropTargetId, insertionBeforeId, insertionIndexForPointer } from "./account-drag-placement"

type DragCandidate = {
  id: string
  variant: "table" | "card"
  sourceClone: HTMLElement
  cellWidths: number[]
  fontFamily: string
  width: number
  height: number
  offsetX: number
  offsetY: number
  startX: number
  startY: number
}

type DragVisual = DragCandidate & { x: number; y: number }

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

export type AccountInventorySort = AccountSort

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
  sectionKey,
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
  canReorder,
  onReorder,
}: {
  sectionKey: "active" | "closed" | "sold"
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
  canReorder: boolean
  onReorder: (sourceId: string, targetId: string) => Promise<void>
}) {
  const { t, language } = useTranslation()
  const locale = language === "ar" ? "ar-SA" : "en-US"
  const [dragVisual, setDragVisual] = useState<DragVisual | null>(null)
  const [insertionIndex, setInsertionIndex] = useState<number | null>(null)
  const sectionRef = useRef<HTMLElement | null>(null)
  const previewRef = useRef<HTMLDivElement | null>(null)
  const candidateRef = useRef<DragCandidate | null>(null)
  const activeRef = useRef<DragVisual | null>(null)
  const insertionRef = useRef<number | null>(null)
  const settlingRef = useRef(false)
  const positionsRef = useRef<Map<string, number> | null>(null)
  const pointerRef = useRef<{ x: number; y: number } | null>(null)
  const autoScrollFrameRef = useRef<number | null>(null)
  const ids = items.map((item) => item.account.id)

  const capturePositions = () => {
    const positions = new Map<string, number>()
    sectionRef.current?.querySelectorAll<HTMLElement>("[data-order-target]").forEach((element) => {
      if (element.getClientRects().length && element.dataset.orderTarget) {
        positions.set(element.dataset.orderTarget, element.getBoundingClientRect().top)
      }
    })
    positionsRef.current = positions
  }

  useLayoutEffect(() => {
    const positions = positionsRef.current
    positionsRef.current = null
    if (!positions || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    sectionRef.current?.querySelectorAll<HTMLElement>("[data-order-target]").forEach((element) => {
      if (!element.getClientRects().length || typeof element.animate !== "function" || typeof element.getAnimations !== "function") return
      const previous = positions.get(element.dataset.orderTarget ?? "")
      if (previous === undefined) return
      element.getAnimations().forEach((animation) => animation.cancel())
      const delta = previous - element.getBoundingClientRect().top
      if (Math.abs(delta) < 2) return
      element.animate(
        [{ transform: `translateY(${delta}px)` }, { transform: "translateY(0)" }],
        { duration: 150, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" }
      )
    })
  }, [insertionIndex, dragVisual])

  const insertionAt = (x: number, y: number, sourceId: string) => {
    const element = document.elementFromPoint(x, y)
    if (!element || element.closest("[data-order-section]") !== sectionRef.current) return null
    if (element.closest("[data-order-gap]")) return insertionRef.current
    const target = element.closest<HTMLElement>("[data-order-target]")
    const id = target?.dataset.orderTarget
    if (!target || !id) return null
    const bounds = target.getBoundingClientRect()
    return insertionIndexForPointer(ids, sourceId, id, y, bounds.top, bounds.height)
  }
  const updateInsertion = (x: number, y: number, id: string) => {
    const nextIndex = insertionAt(x, y, id)
    if (nextIndex !== insertionRef.current) {
      capturePositions()
      insertionRef.current = nextIndex
      setInsertionIndex(nextIndex)
    }
  }
  const scrollDuringDrag = () => {
    autoScrollFrameRef.current = null
    const pointer = pointerRef.current
    const active = activeRef.current
    if (!pointer || !active || settlingRef.current) return
    const edge = 64
    const distance = pointer.y < edge ? pointer.y - edge :
      pointer.y > window.innerHeight - edge ? pointer.y - (window.innerHeight - edge) : 0
    if (!distance) return
    window.scrollBy(0, Math.sign(distance) * Math.min(24, Math.max(6, Math.abs(distance) / 3)))
    updateInsertion(pointer.x, pointer.y, active.id)
    autoScrollFrameRef.current = requestAnimationFrame(scrollDuringDrag)
  }
  const stopAutoScroll = () => {
    if (autoScrollFrameRef.current !== null) cancelAnimationFrame(autoScrollFrameRef.current)
    autoScrollFrameRef.current = null
    pointerRef.current = null
  }
  const clearDrag = () => {
    if (activeRef.current) capturePositions()
    stopAutoScroll()
    candidateRef.current = null
    activeRef.current = null
    insertionRef.current = null
    setDragVisual(null)
    setInsertionIndex(null)
  }
  const settlePreview = async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const overlay = previewRef.current
    const gap = sectionRef.current?.querySelector<HTMLElement>(`[data-order-gap="${activeRef.current?.variant}"]`)
    if (!overlay || !gap) return
    const bounds = gap.getBoundingClientRect()
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 170
    overlay.style.transition = `transform ${duration}ms cubic-bezier(0.2, 0.7, 0.2, 1), box-shadow ${duration}ms ease`
    overlay.style.transform = `translate3d(${bounds.left}px, ${bounds.top}px, 0) scale(1)`
    overlay.style.boxShadow = "0 4px 12px rgba(15, 23, 42, 0.08)"
    if (duration) await new Promise<void>((resolve) => window.setTimeout(resolve, duration))
  }
  const finishDrag = async (id: string, x: number, y: number) => {
    const visual = activeRef.current
    if (!visual || visual.id !== id || settlingRef.current) {
      clearDrag()
      return
    }
    const index = insertionAt(x, y, id)
    const targetId = index === null ? null : dropTargetId(ids, id, index)
    if (!targetId) {
      clearDrag()
      return
    }
    settlingRef.current = true
    stopAutoScroll()
    insertionRef.current = index
    setInsertionIndex(index)
    try {
      await settlePreview()
      if (activeRef.current?.id !== id) return
      await onReorder(id, targetId)
    } finally {
      settlingRef.current = false
      clearDrag()
    }
  }
  const handle = (id: string, index: number) => sort === "custom" ? (
    <button
      type="button"
      aria-label={t("accounts.order.dragHandle", { name: items[index].account.name })}
      aria-describedby={`account-order-help-${sectionKey}`}
      aria-grabbed={dragVisual?.id === id}
      disabled={!canReorder || items.length < 2}
      onClick={stopCardNavigation}
      onPointerDown={(event) => {
        event.stopPropagation()
        if (!canReorder || items.length < 2 || !event.isPrimary || event.button !== 0) return
        const source = event.currentTarget.closest<HTMLElement>("[data-order-target]")
        if (!source) return
        const bounds = source.getBoundingClientRect()
        candidateRef.current = {
          id,
          variant: source.tagName === "TR" ? "table" : "card",
          width: bounds.width,
          height: bounds.height,
          offsetX: event.clientX - bounds.left,
          offsetY: event.clientY - bounds.top,
          startX: event.clientX,
          startY: event.clientY,
          sourceClone: source.cloneNode(true) as HTMLElement,
          cellWidths: source.tagName === "TR"
            ? Array.from(source.children, (cell) => cell.getBoundingClientRect().width)
            : [],
          fontFamily: window.getComputedStyle(source).fontFamily,
        }
        candidateRef.current.sourceClone.removeAttribute("id")
        candidateRef.current.sourceClone.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"))
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        const candidate = candidateRef.current
        if (!candidate || candidate.id !== id || settlingRef.current) return
        if (!activeRef.current) {
          if (Math.hypot(event.clientX - candidate.startX, event.clientY - candidate.startY) < 5) return
          const visual = { ...candidate, x: event.clientX - candidate.offsetX, y: event.clientY - candidate.offsetY }
          activeRef.current = visual
          setDragVisual(visual)
        }
        pointerRef.current = { x: event.clientX, y: event.clientY }
        if (previewRef.current) {
          previewRef.current.style.transform = `translate3d(${event.clientX - candidate.offsetX}px, ${event.clientY - candidate.offsetY}px, 0) scale(1.02)`
        }
        if (autoScrollFrameRef.current === null) autoScrollFrameRef.current = requestAnimationFrame(scrollDuringDrag)
        updateInsertion(event.clientX, event.clientY, id)
      }}
      onPointerUp={(event) => {
        event.stopPropagation()
        if (candidateRef.current?.id === id) void finishDrag(id, event.clientX, event.clientY).catch(clearDrag)
      }}
      onPointerCancel={clearDrag}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === "Escape" && candidateRef.current?.id === id) {
          event.preventDefault()
          clearDrag()
          return
        }
        if (!canReorder) return
        const targetIndex = event.key === "ArrowUp" ? index - 1 : event.key === "ArrowDown" ? index + 1 : -1
        if (targetIndex < 0 || targetIndex >= items.length) return
        event.preventDefault()
        onReorder(id, items[targetIndex].account.id)
      }}
      className="pointer-events-auto inline-flex size-9 shrink-0 touch-none items-center justify-center rounded-lg text-muted-foreground hover:bg-[var(--color-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <GripVertical aria-hidden="true" size={16} />
    </button>
  ) : null

  const draggedItem = items.find((item) => item.account.id === dragVisual?.id)
  const showGap = !!dragVisual && insertionIndex !== null && insertionIndex !== ids.indexOf(dragVisual.id)
  const gapBeforeId = showGap && dragVisual && insertionIndex !== null
    ? insertionBeforeId(ids, dragVisual.id, insertionIndex) : undefined
  const gapHeight = dragVisual?.height ?? 0

  return (
    <section ref={sectionRef} data-order-section={sectionKey} className="mt-5 sm:mt-8">
      {sort === "custom" ? (
        <span id={`account-order-help-${sectionKey}`} className="sr-only">{t("accounts.order.keyboardHint")}</span>
      ) : null}
      {sectionTitle ? (
        <h2 className="font-heading mb-3 text-lg font-semibold text-[var(--color-text-primary)]">
          {sectionTitle}
        </h2>
      ) : null}
      <div className="mt-2 hidden overflow-x-auto border-y border-[var(--color-border)] bg-[var(--color-surface-elevated)] lg:block">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-[var(--color-surface-muted)]">
            <tr className="border-b border-[var(--color-border)]">
              {sort === "custom" ? <th scope="col" className="w-12 px-2"><span className="sr-only">{t("accounts.order.custom")}</span></th> : null}
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
            {items.map((item, index) => {
              const sold = isSoldAccount(item.account)
              const inactive = !item.account.is_active
              return (
                <Fragment key={item.account.id}>
                {gapBeforeId === item.account.id ? <AccountInsertionGap variant="table" height={gapHeight} /> : null}
                <tr
                  data-order-target={item.account.id}
                  className={`cursor-pointer border-b border-[var(--color-border)] transition-colors last:border-b-0 hover:bg-[var(--color-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] ${inactive ? "bg-[var(--color-surface-muted)]/60 text-muted-foreground" : ""} ${dragVisual?.id === item.account.id ? "opacity-0" : ""}`}
                  tabIndex={0}
                  onClick={() => onOpenAccount(item.account)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      onOpenAccount(item.account)
                    }
                  }}
                >
                  {sort === "custom" ? <td className="px-2 py-2" onClick={stopCardNavigation}>{handle(item.account.id, index)}</td> : null}
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
                </Fragment>
              )
            })}
            {gapBeforeId === null ? <AccountInsertionGap variant="table" height={gapHeight} /> : null}
          </tbody>
        </table>
      </div>
      <div className="mt-2 divide-y divide-[var(--color-border)] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] shadow-[0_8px_24px_rgba(15,23,42,0.05)] lg:hidden">
        {items.map((item, index) => {
          const sold = isSoldAccount(item.account)
          const inactive = !item.account.is_active
          const typeVisual =
            accountTypeVisuals[
              item.account.account_type_code as AccountTypeCode
            ]
          const TypeIcon = typeVisual.icon
          return (
            <Fragment key={item.account.id}>
            {gapBeforeId === item.account.id ? <AccountInsertionGap variant="card" height={gapHeight} /> : null}
            <div
              data-order-target={item.account.id}
              className={`relative rounded-xl px-3.5 py-3 transition-colors hover:bg-[var(--color-surface-hover)] ${inactive ? "bg-[var(--color-surface-muted)]/60 text-muted-foreground" : ""} ${dragVisual?.id === item.account.id ? "opacity-0" : ""}`}
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
                  {sort === "custom" ? handle(item.account.id, index) : null}
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
            </Fragment>
          )
        })}
        {gapBeforeId === null ? <AccountInsertionGap variant="card" height={gapHeight} /> : null}
      </div>
      {dragVisual && draggedItem && typeof document !== "undefined" ? createPortal(
        <AccountDragPreview
          variant={dragVisual.variant}
          sourceClone={dragVisual.sourceClone}
          cellWidths={dragVisual.cellWidths}
          fontFamily={dragVisual.fontFamily}
          width={dragVisual.width}
          height={dragVisual.height}
          x={dragVisual.x}
          y={dragVisual.y}
          offsetX={dragVisual.offsetX}
          offsetY={dragVisual.offsetY}
          direction={language === "ar" ? "rtl" : "ltr"}
          previewRef={previewRef}
        />,
        document.body
      ) : null}
    </section>
  )
}
