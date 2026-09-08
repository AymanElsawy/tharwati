import { describe, expect, it } from "vitest"

import { isSoldAccount, partitionAccountLifecycle } from "./account-lifecycle"

describe("account lifecycle presentation", () => {
  it("keeps a sale distinct from an ordinary archive", () => {
    expect(isSoldAccount({ closed_reason: "sold" })).toBe(true)
    expect(isSoldAccount({ closed_reason: null })).toBe(false)
  })

  it("keeps sold accounts in their own list section instead of archived filtering", () => {
    const result = partitionAccountLifecycle([
      { account: { closed_reason: null, is_active: true }, id: "active" },
      { account: { closed_reason: null, is_active: false }, id: "closed" },
      { account: { closed_reason: "sold", is_active: false }, id: "sold" },
    ])
    expect(result.activeItems.map((item) => item.id)).toEqual(["active"])
    expect(result.closedItems.map((item) => item.id)).toEqual(["closed"])
    expect(result.soldItems.map((item) => item.id)).toEqual(["sold"])
  })
})
