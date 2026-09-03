import { describe, expect, it } from "vitest"

import {
  createAccountDisposalFormState,
  isPositiveSaleAmount,
  normalizeSaleAmount,
  resolveAccountDisposalSubmissionAttempt,
} from "./account-disposal-form"

describe("account disposal form state", () => {
  it("defaults an EGP account to EGP instead of SAR", () => {
    expect(
      createAccountDisposalFormState({ currency_code: "EGP" }, "2026-09-02")
        .currency
    ).toBe("EGP")
  })

  it("reuses one key for an identical retry and rotates it for changed data", () => {
    let sequence = 0
    const generateKey = () => `key-${++sequence}`
    const input = {
      disposedOn: "2026-09-02",
      saleAmount: "100.00",
      saleCurrencyCode: "EGP",
      ownershipPercentageSold: "25.00",
      destinationAccountId: "cash-egp",
      notes: "Sale",
    }
    const first = resolveAccountDisposalSubmissionAttempt(null, input, generateKey)
    const retry = resolveAccountDisposalSubmissionAttempt(first, {
      ...input,
      saleAmount: "100",
      ownershipPercentageSold: "25",
    }, generateKey)
    const changed = resolveAccountDisposalSubmissionAttempt(retry, {
      ...input,
      saleAmount: "101",
    }, generateKey)

    expect(retry).toBe(first)
    expect(changed.idempotencyKey).toBe("key-2")
  })

  it("creates clean state for every account dialog session", () => {
    const first = createAccountDisposalFormState(
      { currency_code: "EGP" },
      "2026-09-02"
    )
    first.amount = "100"
    first.destinationAccountId = "cash-egp"

    expect(
      createAccountDisposalFormState({ currency_code: "USD" }, "2026-09-03")
    ).toEqual({
      amount: "",
      soldOn: "2026-09-03",
      currency: "USD",
      destinationAccountId: "",
      ownershipSold: "",
      notes: "",
    })
  })

  it("distinguishes positive, zero, negative, and invalid amounts without floats", () => {
    expect(isPositiveSaleAmount("100.10")).toBe(true)
    expect(isPositiveSaleAmount("0")).toBe(false)
    expect(normalizeSaleAmount("0.00")).toBe("0")
    expect(normalizeSaleAmount("-1")).toBeNull()
    expect(normalizeSaleAmount("nope")).toBeNull()
  })
})
