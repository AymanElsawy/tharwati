import { describe, expect, it } from "vitest"

import loginPage from "./LoginPage.tsx?raw"
import { en } from "@/i18n/en/translations"
import { ar } from "@/i18n/ar/translations"

describe("LoginPage password recovery entry point", () => {
  it("reuses the existing forgot-password route with localized copy", () => {
    expect(loginPage).toContain('navigate("/forgot-password")')
    expect(loginPage).toContain('t("auth.forgotPassword")')
    expect(en["auth.forgotPassword"]).toBe("Forgot password?")
    expect(ar["auth.forgotPassword"]).toBe("نسيت كلمة المرور؟")
  })

  it("shows a generic localized login failure instead of a backend message", () => {
    expect(loginPage).toContain('setErrorMessage(t("auth.loginError"))')
    expect(loginPage).not.toContain("error instanceof Error ? error.message")
  })
})
