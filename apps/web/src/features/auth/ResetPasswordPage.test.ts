import { describe, expect, it } from "vitest"

import app from "../../app/App.tsx?raw"
import resetPasswordPage from "./ResetPasswordPage.tsx?raw"

describe("password recovery gate", () => {
  it("confirms a recovery session before enabling the form", () => {
    expect(app).toContain('window.location.pathname === "/reset-password"')
    expect(app).toContain('event === "PASSWORD_RECOVERY"')
    expect(app).toContain(
      'setRecoveryStatus(currentSession ? "valid" : "invalid")'
    )
    expect(resetPasswordPage).toContain('recoveryStatus === "invalid"')
    expect(resetPasswordPage).toContain('recoveryStatus === "checking"')
    expect(resetPasswordPage).toContain("<form onSubmit={handleSubmit}")
  })

  it("offers another reset link when recovery is invalid", () => {
    expect(resetPasswordPage).toContain("Request a new reset link")
    expect(app).toContain('window.location.assign("/forgot-password")')
  })
})
