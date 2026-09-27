import { describe, expect, it } from "vitest"
import page from "./AccountsPage.tsx?raw"
import inventory from "../components/AccountInventory.tsx?raw"
import accountsHook from "../hooks/useAccounts.ts?raw"

describe("Accounts page Custom-order wiring", () => {
  it("uses Custom as the page default and offers all four sort modes", () => {
    expect(page).toContain("useState<AccountInventorySort>(defaultAccountSort)")
    for (const mode of ["custom", "name", "type", "balance"]) {
      expect(page).toContain(`<option value="${mode}">`)
    }
    expect(page).toContain("sortAccountItems(withBalance, sort, direction, accounts.customOrder)")
  })

  it("passes guarded reorder controls to all lifecycle sections", () => {
    expect(page).toContain("hasCompleteAccountOrder(accounts.accounts, accounts.customOrder)")
    expect(page).toContain("!isAccountSubsetFiltered(filters, metalFilter)")
    expect(page.match(/onReorder=\{reorderSection\}/g)).toHaveLength(3)
    expect(inventory).toContain('sort === "custom" ? handle(')
  })

  it("refreshes canonical order with account lifecycle mutations", () => {
    expect(accountsHook).toContain("accountsRepository.getAccountCustomOrder(signal)")
    expect(accountsHook).toContain("await loadAccounts(false)")
    for (const operation of ["accounts.create", "accounts.close", "accounts.reopen", "accounts.delete"]) {
      expect(accountsHook).toContain(`runMutation("${operation}"`)
    }
    expect(accountsHook).toContain("setCustomOrder(committed)")
  })

  it("shows localized notices and never exposes backend error text", () => {
    expect(page).toContain('"accounts.order.clearFilters"')
    expect(page).toContain('"accounts.order.conflict"')
    expect(page).toContain('"accounts.order.failure"')
    expect(page).toContain('"accounts.order.refreshFailure"')
    expect(page).not.toContain("error.message")
  })
})
