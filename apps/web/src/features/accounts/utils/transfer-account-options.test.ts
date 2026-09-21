import { describe, expect, it } from "vitest"

import { transferAccountOptions } from "./transfer-account-options"

const accounts = [
  { id: "cash", currency_code: "SAR" },
  { id: "bank", currency_code: "SAR" },
  { id: "usd", currency_code: "USD" },
] as never

describe("transferAccountOptions", () => {
  it("never offers the opposite selected account", () => {
    expect(
      transferAccountOptions(accounts, "cash").map(({ id }) => id)
    ).toEqual(["bank", "usd"])
  })

  it("updates reciprocal options while preserving valid transfer accounts", () => {
    expect(
      transferAccountOptions(accounts, "bank").map(({ id }) => id)
    ).toEqual(["cash", "usd"])
    expect(transferAccountOptions(accounts, "").map(({ id }) => id)).toEqual([
      "cash",
      "bank",
      "usd",
    ])
  })
})
