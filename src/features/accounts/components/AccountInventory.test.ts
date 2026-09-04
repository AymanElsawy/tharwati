import { describe, expect, it } from "vitest"

import accountInventory from "./AccountInventory.tsx?raw"

describe("AccountInventory mobile navigation affordance", () => {
  it("keeps the card target and labels it as opening account details", () => {
    expect(accountInventory).toContain('role="button"')
    expect(accountInventory).toContain(
      'aria-label={t("accounts.table.openLabel", { name: item.account.name })}'
    )
    expect(accountInventory).toContain('onClick={() => onOpenAccount(item.account)}')
  })

  it("shows a direction-aware, non-interactive chevron on mobile cards", () => {
    expect(accountInventory).toContain('language === "ar" ? <ChevronLeft')
    expect(accountInventory).toContain('<ChevronRight aria-hidden="true"')
  })
})
