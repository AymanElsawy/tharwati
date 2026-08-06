import { describe, expect, it } from "vitest"
import { buildEditInvestmentArgs, requireInvestmentDecimal } from "./edit-investment.service"

describe("edit investment decimal boundary", () => {
  it("preserves exact values beyond JavaScript safe precision", () => {
    const value = "9007199254740993.0000000001"
    expect(requireInvestmentDecimal(value, "quantity")).toBe(value)
  })

  it("rejects runtime numbers rather than coercing them", () => {
    expect(() => requireInvestmentDecimal(12.5, "quantity")).toThrow(
      "quantity must be an exact PostgreSQL decimal string",
    )
  })

  it("matches the exact six-parameter correction RPC contract", () => {
    const args = buildEditInvestmentArgs({
      transactionId: "11111111-1111-4111-8111-111111111111",
      accountId: "22222222-2222-4222-8222-222222222222",
      accountName: "Brokerage",
      assetId: "33333333-3333-4333-8333-333333333333",
      assetName: "NVIDIA",
      quantity: "2.5",
      unitPrice: "100.25",
      fees: "4.50",
      occurredAt: "2026-08-01",
      notes: " corrected ",
    })
    expect(Object.keys(args).sort()).toEqual([
      "p_fees", "p_notes", "p_occurred_at", "p_quantity", "p_transaction_id", "p_unit_price",
    ])
    expect(args.p_notes).toBe("corrected")
    expect(args).not.toHaveProperty("p_account_id")
    expect(args).not.toHaveProperty("p_asset_id")
  })
})
