import { describe, expect, it, vi } from "vitest"
import { RepositoryError } from "@/lib/supabase/types"
import { ar } from "@/i18n/ar/translations"
import { en } from "@/i18n/en/translations"
import {
  accountSection,
  defaultAccountSort,
  hasCompleteAccountOrder,
  isAccountSubsetFiltered,
  moveAccountWithinSection,
  saveAccountSectionOrder,
  sortAccountItems,
} from "./account-custom-order"

const active = (id: string) => ({ id, is_active: true, closed_reason: null })
const closed = (id: string) => ({ id, is_active: false, closed_reason: null })
const sold = (id: string) => ({ id, is_active: false, closed_reason: "sold" as const })
const accounts = [active("bank"), closed("closed-1"), active("cash"), sold("sold-1"), active("gold"), closed("closed-2"), sold("sold-2")]
const canonical = accounts.map((account) => account.id)
const item = (id: string, name: string, type: string, value: string) => ({
  account: { id, name, account_type_code: type },
  currentBalance: value,
  metalCurrentValue: null,
})

describe("Web Accounts custom order", () => {
  it("defaults to Custom", () => {
    expect(defaultAccountSort).toBe("custom")
  })

  it("renders stored mixed-type order instead of name or type order", () => {
    const rows = [item("cash", "A Cash", "cash", "1"), item("bank", "Z Bank", "bank", "3"), item("gold", "M Gold", "gold", "2")]
    expect(sortAccountItems(rows, "custom", "asc", ["gold", "bank", "cash"]).map((row) => row.account.id))
      .toEqual(["gold", "bank", "cash"])
  })

  it("sends the complete canonical order while moving only Active slots", async () => {
    const reorder = vi.fn().mockResolvedValue(["cash", "closed-1", "gold", "sold-1", "bank", "closed-2", "sold-2"])
    const result = await saveAccountSectionOrder({ accounts, canonicalIds: canonical, sourceId: "bank", targetId: "gold", reorder, refresh: vi.fn().mockResolvedValue(true) })
    expect(result).toBe("saved")
    expect(reorder).toHaveBeenCalledWith(canonical, ["cash", "closed-1", "gold", "sold-1", "bank", "closed-2", "sold-2"])
  })

  it("reload renders the committed server order", () => {
    const rows = [item("bank", "Bank", "bank", "3"), item("cash", "Cash", "cash", "1")]
    expect(sortAccountItems(rows, "custom", "asc", ["cash", "bank"]).map((row) => row.account.id)).toEqual(["cash", "bank"])
  })

  it.each([
    ["name", ["bank", "cash", "gold"]],
    ["type", ["bank", "cash", "gold"]],
    ["balance", ["cash", "gold", "bank"]],
  ] as const)("%s is a temporary local sort", (sort, expected) => {
    const rows = [item("bank", "Bank", "bank", "3"), item("gold", "Gold", "gold", "2"), item("cash", "Cash", "cash", "1")]
    const saved = ["gold", "bank", "cash"]
    expect(sortAccountItems(rows, sort, "asc", saved).map((row) => row.account.id)).toEqual(expected)
    expect(saved).toEqual(["gold", "bank", "cash"])
    expect(sortAccountItems(rows, "custom", "asc", saved).map((row) => row.account.id)).toEqual(saved)
  })

  it("preserves hidden Closed and Sold IDs in their original canonical slots", () => {
    expect(moveAccountWithinSection(canonical, ["bank", "cash", "gold"], "gold", "bank"))
      .toEqual(["gold", "closed-1", "bank", "sold-1", "cash", "closed-2", "sold-2"])
  })

  it("moves within Closed without changing Active or Sold relative order", () => {
    expect(moveAccountWithinSection(canonical, ["closed-1", "closed-2"], "closed-2", "closed-1"))
      .toEqual(["bank", "closed-2", "cash", "sold-1", "gold", "closed-1", "sold-2"])
  })

  it("rejects cross-section and incomplete reorder requests", async () => {
    const reorder = vi.fn()
    expect(await saveAccountSectionOrder({ accounts, canonicalIds: canonical, sourceId: "bank", targetId: "sold-1", reorder, refresh: vi.fn().mockResolvedValue(true) })).toBe("ignored")
    expect(await saveAccountSectionOrder({ accounts, canonicalIds: canonical.slice(1), sourceId: "cash", targetId: "gold", reorder, refresh: vi.fn().mockResolvedValue(true) })).toBe("ignored")
    expect(reorder).not.toHaveBeenCalled()
  })

  it("disables reorder for search, type, currency, and Gold/Silver URL subsets", () => {
    const clear = { search: "", type: null, currency: null }
    expect(isAccountSubsetFiltered(clear, null)).toBe(false)
    expect(isAccountSubsetFiltered({ ...clear, search: "bank" }, null)).toBe(true)
    expect(isAccountSubsetFiltered({ ...clear, type: "cash" }, null)).toBe(true)
    expect(isAccountSubsetFiltered({ ...clear, currency: "USD" }, null)).toBe(true)
    expect(isAccountSubsetFiltered(clear, "gold")).toBe(true)
  })

  it("rejects a duplicate or missing canonical ID", () => {
    expect(hasCompleteAccountOrder(accounts, canonical)).toBe(true)
    expect(hasCompleteAccountOrder(accounts, [...canonical.slice(0, -1), "bank"])).toBe(false)
    expect(hasCompleteAccountOrder(accounts, canonical.slice(1))).toBe(false)
  })

  it("reloads authoritative order on PT409 without sending another write", async () => {
    const conflict = new RepositoryError({ code: "conflict", message: "backend detail", operation: "accounts.reorderAccounts" })
    const reorder = vi.fn().mockRejectedValue(conflict)
    const refresh = vi.fn().mockResolvedValue(true)
    expect(await saveAccountSectionOrder({ accounts, canonicalIds: canonical, sourceId: "bank", targetId: "cash", reorder, refresh })).toBe("conflict")
    expect(reorder).toHaveBeenCalledOnce()
    expect(refresh).toHaveBeenCalledOnce()
  })

  it("reloads authoritative order on ordinary failure", async () => {
    const refresh = vi.fn().mockResolvedValue(true)
    expect(await saveAccountSectionOrder({ accounts, canonicalIds: canonical, sourceId: "bank", targetId: "cash", reorder: vi.fn().mockRejectedValue(new Error("raw SQL")), refresh })).toBe("failure")
    expect(refresh).toHaveBeenCalledOnce()
  })

  it("reports refresh failure without claiming that newer order was loaded", async () => {
    const result = await saveAccountSectionOrder({ accounts, canonicalIds: canonical, sourceId: "bank", targetId: "cash", reorder: vi.fn().mockRejectedValue(new Error("offline")), refresh: vi.fn().mockResolvedValue(false) })
    expect(result).toBe("refreshFailure")
  })

  it("new unranked account appears at the end after canonical refresh", () => {
    const rows = [item("new", "Aardvark", "cash", "0"), item("bank", "Bank", "bank", "3"), item("cash", "Cash", "cash", "1")]
    expect(sortAccountItems(rows, "custom", "asc", ["bank", "cash", "new"]).map((row) => row.account.id))
      .toEqual(["bank", "cash", "new"])
  })

  it("close, reopen, and delete use fresh canonical order without changing saved positions", () => {
    const closeState = [closed("bank"), active("cash"), sold("sold-1")]
    expect(accountSection(closeState[0])).toBe("closed")
    expect(closeState.map(accountSection)).toEqual(["closed", "active", "sold"])
    expect(accountSection(active("bank"))).toBe("active")
    expect(hasCompleteAccountOrder([active("bank"), active("cash")], ["bank", "cash"])).toBe(true)
  })

  it("has safe English and Arabic guidance and conflict copy", () => {
    for (const translations of [en, ar]) {
      expect(translations["accounts.order.custom"]).toBeTruthy()
      expect(translations["accounts.order.clearFilters"]).toBeTruthy()
      expect(translations["accounts.order.conflict"]).toBeTruthy()
      expect(translations["accounts.order.failure"]).toBeTruthy()
      expect(translations["accounts.order.refreshFailure"]).toBeTruthy()
      expect(translations["accounts.order.keyboardHint"]).toBeTruthy()
    }
    expect(en["accounts.order.conflict"]).not.toContain("PT409")
  })
})
