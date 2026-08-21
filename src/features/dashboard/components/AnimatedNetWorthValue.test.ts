import { describe, expect, it } from "vitest"

import {
  easeOutCubic,
  interpolateNetWorthValue,
  netWorthAnimationDurationMs,
} from "./AnimatedNetWorthValue"

describe("AnimatedNetWorthValue", () => {
  it("uses a short eased animation duration", () => {
    expect(netWorthAnimationDurationMs).toBe(500)
  })

  it("interpolates from the current displayed value to the resolved total", () => {
    expect(interpolateNetWorthValue(0, 1_000, 0)).toBe(0)
    expect(interpolateNetWorthValue(0, 1_000, 1)).toBe(1_000)
    expect(interpolateNetWorthValue(1_000, 250, 1)).toBe(250)
    expect(interpolateNetWorthValue(0, 1_000, 0.5)).toBeGreaterThan(500)
    expect(easeOutCubic(1)).toBe(1)
  })
})
