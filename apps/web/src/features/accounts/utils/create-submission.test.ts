import { describe, expect, it, vi } from "vitest"
import { createFingerprint } from "./create-submission"
import { resolveSubmissionAttempt, type SubmissionAttempt } from "./refund-submission"
import { runMutationThenRefresh } from "@/lib/mutations/mutation-refresh"
import { accountCreateParams } from "../repositories/accounts.repository"

const cases = [
  ["metal", { p_account_id: "metal", p_purity: "24k", p_quantity_grams: "2.00", p_cost_per_unit: "10.0", p_fees: "0", p_notes: "lot" }, { p_quantity_grams: "2", p_purity: "24K" }],
  ["holding", { p_account_id: "brokerage", p_asset_id: "asset", p_quantity: "2.00", p_average_cost: "10", p_account_fx_rate: "3.750", p_notes: "lot" }, { p_quantity: "2", p_account_fx_rate: "3.75" }],
  ["valuation", { p_account_id: "property", p_valuation_amount: "500.00", p_valued_on: "2026-09-01", p_valuation_method: "other:  valuation  ", p_notes: "lot" }, { p_valuation_amount: "500", p_valuation_method: "other:valuation" }],
  ["ordinary", accountCreateParams({ accountTypeCode: "bank", name: "Bank", currencyCode: "USD", openingBalance: "50.00", bankSubtype: "credit", creditCardLimit: "100.0" }), { p_opening_balance: "50", p_credit_card_limit: "100" }],
  ["valued", accountCreateParams({ accountTypeCode: "real_estate", name: "Home", currencyCode: "USD", propertyType: "villa", ownershipPercentage: "100.0", valuationAmount: "500.00", valuedOn: "2026-09-01" }), { p_ownership_percentage: "100", p_valuation_amount: "500" }],
] as const

describe("Slice 3 submission attempts", () => {
  it.each(cases)("%s reuses a normalized uncertain attempt, rotates on change, and never writes on refresh retry", async (_, payload, equivalent) => {
    let attempt: SubmissionAttempt | null = null
    const keys: string[] = []
    let reject = true
    const mutate = vi.fn(async () => {
      keys.push(attempt!.idempotencyKey)
      if (reject) throw new Error("response lost")
    })
    const refresh = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined)
    const submit = async (input: object) => {
      attempt = resolveSubmissionAttempt(attempt, createFingerprint(input))
      return runMutationThenRefresh({ mutate, onCommitted: () => { attempt = null }, refresh })
    }
    expect((await submit(payload)).mutation).toBe("rejected")
    expect((await submit({ ...payload, ...equivalent })).mutation).toBe("rejected")
    expect(keys[0]).toBe(keys[1])
    expect((await submit({ ...payload, p_notes: "changed" })).mutation).toBe("rejected")
    expect(keys[2]).not.toBe(keys[1])
    reject = false
    expect(await submit({ ...payload, p_notes: "changed" })).toEqual({ mutation: "committed", refresh: "stale" })
    expect(keys[3]).toBe(keys[2])
    expect(attempt).toBeNull()
    await refresh()
    expect(mutate).toHaveBeenCalledTimes(4)
    await submit({ ...payload, p_notes: "changed" })
    expect(keys[4]).not.toBe(keys[3])
  })

  it("hashes only effective valued-account fields and preserves numeric-looking notes", () => {
    const input = { accountTypeCode: "real_estate", name: "Home", currencyCode: "USD", valuedOn: "2026-09-01" }
    expect(createFingerprint(accountCreateParams(input))).toBe(createFingerprint(accountCreateParams({ ...input, businessType: "ignored", industry: "ignored" })))
    expect(createFingerprint({ p_notes: "01" })).not.toBe(createFingerprint({ p_notes: "1" }))
  })
})
