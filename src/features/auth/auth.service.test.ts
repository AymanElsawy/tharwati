import { AuthApiError, AuthSessionMissingError } from "@supabase/supabase-js"
import { describe, expect, it } from "vitest"

import {
  getPasswordUpdateErrorMessage,
  meetsPasswordRequirements,
  PASSWORD_UPDATE_GENERIC_ERROR,
  PASSWORD_UPDATE_SESSION_ERROR,
  PASSWORD_UPDATE_WEAK_ERROR,
} from "./auth.service"

describe("getPasswordUpdateErrorMessage", () => {
  it("maps weak-password policy messages without exposing backend details", () => {
    const error = new AuthApiError(
      "Password must contain an uppercase letter",
      422,
      "weak_password"
    )

    expect(getPasswordUpdateErrorMessage(error)).toBe(PASSWORD_UPDATE_WEAK_ERROR)
  })

  it("maps a missing session to a new-link prompt", () => {
    expect(getPasswordUpdateErrorMessage(new AuthSessionMissingError())).toBe(
      PASSWORD_UPDATE_SESSION_ERROR
    )
  })

  it("maps other failures to a generic retry message", () => {
    expect(getPasswordUpdateErrorMessage(new Error("backend details"))).toBe(
      PASSWORD_UPDATE_GENERIC_ERROR
    )
  })
})

describe("meetsPasswordRequirements", () => {
  it("requires the hosted minimum, lowercase, uppercase, and a number", () => {
    expect(meetsPasswordRequirements("password1234")).toBe(false)
    expect(meetsPasswordRequirements("PASSWORD1234")).toBe(false)
    expect(meetsPasswordRequirements("PasswordOnly")).toBe(false)
    expect(meetsPasswordRequirements("Password123")).toBe(false)
    expect(meetsPasswordRequirements("Password1234")).toBe(true)
  })
})
