import { describe, expect, it, vi } from "vitest"

import accountInventory from "./AccountInventory.tsx?raw"
import { stopCardNavigation } from "./account-inventory-interactions"

describe("AccountInventory mobile cards", () => {
  it("uses a native card button with an account-details label", () => {
    expect(accountInventory).toContain('<button\n                type="button"')
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
