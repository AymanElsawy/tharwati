import { describe, expect, it } from "vitest"
import { canPermanentlyDelete, confirmReauthentication, openDeleteAccountFlow, resetDeleteAccountFlow } from "./delete-account-flow"

describe("delete account confirmation flow", () => {
  it("requires password step before exact-email confirmation", () => {
    expect(openDeleteAccountFlow().step).toBe("password")
    const flow = confirmReauthentication("secret")
    expect(flow.step).toBe("confirmation")
    expect(canPermanentlyDelete({ ...flow, confirmation: "OWNER@example.test" }, "owner@example.test")).toBe(false)
    expect(canPermanentlyDelete({ ...flow, confirmation: "owner@example.test" }, "owner@example.test")).toBe(true)
  })

  it("clears password and confirmation on cancel or failure", () => {
    expect(resetDeleteAccountFlow()).toEqual({ step: "closed", password: "", confirmation: "" })
  })
})
