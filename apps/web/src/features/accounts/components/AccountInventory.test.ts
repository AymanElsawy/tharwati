import { describe, expect, it, vi } from "vitest"

import accountInventory from "./AccountInventory.tsx?raw"
import dragVisuals from "./AccountDragVisuals.tsx?raw"
import { stopCardNavigation } from "./account-inventory-interactions"

describe("AccountInventory mobile cards", () => {
  it("keeps the inventory in page flow with horizontal-only table overflow", () => {
    expect(accountInventory).toContain('className="mt-2 hidden overflow-x-auto border-y')
    expect(accountInventory).not.toContain("max-h-[44rem]")
    expect(accountInventory).not.toContain("data-order-scroll")
    expect(accountInventory).not.toContain('<thead className="sticky')
    expect(accountInventory).toContain("window.scrollBy(0,")
    expect(accountInventory).toContain("requestAnimationFrame(scrollDuringDrag)")
    expect(accountInventory).toContain("cancelAnimationFrame(autoScrollFrameRef.current)")
    expect(accountInventory).toContain("updateInsertion(pointer.x, pointer.y, active.id)")
  })

  it("keeps row and card navigation separate from Custom drag handles", () => {
    expect(accountInventory).toContain("data-order-target={item.account.id}")
    expect(accountInventory).toContain('sort === "custom" ? handle(item.account.id, index)')
    expect(accountInventory).toContain("onClick={() => onOpenAccount(item.account)}")
    expect(accountInventory).toContain("onClick={stopCardNavigation}")
    expect(accountInventory).toContain("onPointerDown={(event) => {")
    expect(accountInventory).toContain("event.currentTarget.setPointerCapture(event.pointerId)")
  })

  it("offers keyboard movement and a logical-layout handle on table and cards", () => {
    expect(accountInventory).toContain('event.key === "ArrowUp"')
    expect(accountInventory).toContain('event.key === "ArrowDown"')
    expect(accountInventory).toContain('aria-describedby={`account-order-help-${sectionKey}`}')
    expect(accountInventory).toContain("touch-none")
    expect(accountInventory).toContain('className="px-2 py-2"')
    expect(accountInventory).toContain('className="flex items-start gap-2.5"')
  })

  it("starts the visual preview only after pointer movement and persists only after drop", () => {
    expect(accountInventory).toContain("Math.hypot(event.clientX - candidate.startX")
    expect(accountInventory).toContain("setDragVisual(visual)")
    expect(accountInventory).toContain("<AccountDragPreview")
    expect(accountInventory).toContain("<AccountInsertionGap")
    expect(accountInventory).toContain("source.cloneNode(true)")
    expect(dragVisuals).toContain("host.replaceChildren(sourceClone)")
    expect(dragVisuals).toContain("cellWidths.map")
    expect(dragVisuals).toContain("transformOrigin: `${offsetX}px ${offsetY}px`")
    expect(accountInventory).toContain("dragVisual?.id === item.account.id ? \"opacity-0\"")
    expect(dragVisuals).not.toContain("border-dashed")
    expect(accountInventory).toContain("capturePositions()")
    expect(accountInventory).toContain("element.animate(")
    expect(accountInventory).toContain("await settlePreview()")
    expect(accountInventory).toContain("await onReorder(id, targetId)")
    expect(accountInventory.indexOf("await settlePreview()")).toBeLessThan(accountInventory.indexOf("await onReorder(id, targetId)"))
    const pointerMovement = accountInventory.split("onPointerMove={(event) => {")[1].split("onPointerUp={(event) => {")[0]
    expect(pointerMovement).not.toContain("onReorder(")
    expect(accountInventory).toContain("onPointerCancel={clearDrag}")
  })

  it("uses a native card button with an account-details label", () => {
    expect(accountInventory).toMatch(/<button\s+type="button"/)
    expect(accountInventory).toContain(
      'aria-label={t("accounts.table.openLabel",'
    )
    expect(accountInventory).toContain(
      "onClick={() => onOpenAccount(item.account)}"
    )
  })

  it("uses compact overflow menu instead of persistent actions", () => {
    expect(accountInventory).toContain("<DropdownMenu>")
    expect(accountInventory).toContain('aria-label={t("accounts.card.actions"')
    expect(accountInventory).toContain("<MoreHorizontal")
    expect(accountInventory).toContain("min-h-11")
  })

  it("stops keyboard and pointer action events from card navigation", () => {
    const stopPropagation = vi.fn()

    stopCardNavigation({ stopPropagation })

    expect(stopPropagation).toHaveBeenCalledOnce()
    expect(accountInventory).toContain("onPointerDown={stopCardNavigation}")
    expect(accountInventory).toContain("onKeyDown={stopCardNavigation}")
  })

  it("renders type icon, lifecycle state, and currency metadata", () => {
    expect(accountInventory).toContain("accountTypeVisuals[")
    expect(accountInventory).toContain('"accounts.card.active"')
    expect(accountInventory).toContain('"accounts.card.archived"')
    expect(accountInventory).toContain(
      'dir="ltr">{item.account.currency_code}</span>'
    )
  })

  it("shows a direction-aware, decorative disclosure chevron", () => {
    expect(accountInventory).toContain('language === "ar" ? (')
    expect(accountInventory).toContain("<ChevronLeft")
    expect(accountInventory).toContain("<ChevronRight")
    expect(accountInventory).toContain('aria-hidden="true"')
  })
})
