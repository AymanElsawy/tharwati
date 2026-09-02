import { AuthApiError, AuthSessionMissingError } from "@supabase/supabase-js"
import { describe, expect, it } from "vitest"

import {
  getPasswordUpdateErrorMessage,
  PASSWORD_UPDATE_GENERIC_ERROR,
  PASSWORD_UPDATE_SESSION_ERROR,
} from "./auth.service"

describe("getPasswordUpdateErrorMessage", () => {
  it("preserves weak-password policy messages", () => {
    const error = new AuthApiError(
      "Password must contain an uppercase letter",
      422,
      "weak_password"
    )

    expect(getPasswordUpdateErrorMessage(error)).toBe(error.message)
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
