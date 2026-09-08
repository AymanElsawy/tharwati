import { describe, expect, it } from "vitest"
import { formatGoalMoney } from "./goal-money"

describe("formatGoalMoney", () => {
  it("keeps the sign, currency, and decimal amount in a stable LTR order", () => {
    expect(formatGoalMoney("1234.5", "EGP", "ar-SA", "−")).toMatch(/^−.+ EGP$/)
  })
})
