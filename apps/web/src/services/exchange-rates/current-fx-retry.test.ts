import { describe, expect, it } from "vitest"

import { isRetryableCurrentFxPair } from "./current-fx-retry"

describe("current FX retry classification", () => {
  it.each([
    ["USD", "SAR"],
    ["EUR", "SAR"],
    ["SAR", "USD"],
    ["USD", "EGP"],
    ["EUR", "GBP"],
  ])("treats %s/%s as retryable through the shared contract", (from, to) => {
    expect(isRetryableCurrentFxPair(from, to)).toBe(true)
  })

  it.each([
    ["USD", "USD"],
    ["US", "SAR"],
    ["USD", ""],
  ])("does not retry an invalid or identity pair %s/%s", (from, to) => {
    expect(isRetryableCurrentFxPair(from, to)).toBe(false)
  })
})
