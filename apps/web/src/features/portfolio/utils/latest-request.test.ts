import { describe, expect, it } from "vitest"

import { LatestRequestGuard } from "./latest-request"

describe("LatestRequestGuard", () => {
  it("rejects stale responses after a newer request begins", () => {
    const guard = new LatestRequestGuard()
    const first = guard.begin()
    const second = guard.begin()

    expect(guard.isCurrent(first)).toBe(false)
    expect(guard.isCurrent(second)).toBe(true)
  })
})
