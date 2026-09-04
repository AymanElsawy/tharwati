import { useId, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  getPasswordUpdateErrorMessage,
  isWeakPasswordError,
  meetsPasswordRequirements,
  PASSWORD_MIN_LENGTH,
  PASSWORD_UPDATE_SESSION_ERROR,
  signOut,
  updatePassword,
} from "./auth.service"
import { useTranslation } from "@/i18n/useTranslation"

type ResetPasswordPageProps = {
  recoveryStatus: "checking" | "valid" | "invalid"
  /** Called after the password is changed and the recovery session is cleared. */
  onComplete: () => void
  onRequestNewLink: () => void
}

export function ResetPasswordPage({
  recoveryStatus,
  onComplete,
  onRequestNewLink,
}: ResetPasswordPageProps) {
  const { t } = useTranslation()
  const passwordId = useId()
  const confirmId = useId()

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [done, setDone] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!meetsPasswordRequirements(password)) {
      setErrorMessage(t("auth.password.weak"))
      return
    }
    if (password !== confirm) {
      setErrorMessage(t("auth.password.mismatch"))
      return
    }

    try {
      setIsLoading(true)
      setErrorMessage("")
      await updatePassword(password)
      // Drop the recovery session so the user signs in fresh with the new password.
      await signOut().catch(() => undefined)
      setDone(true)
    } catch (error) {
      console.error("password update failed", error)
      setErrorMessage(
        isWeakPasswordError(error)
          ? t("auth.password.weak")
          : getPasswordUpdateErrorMessage(error)
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--color-background)] px-4 py-12 sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,var(--color-primary-soft),transparent_48%)] opacity-70"
      />

      <section className="tharwati-card relative w-full max-w-sm space-y-5 px-6 py-8 sm:px-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Choose a new password
          </h1>
          <p className="mt-1.5 text-sm text-[var(--color-text-secondary)]">
            {recoveryStatus === "checking"
              ? "Checking your reset link..."
              : recoveryStatus === "invalid"
                ? PASSWORD_UPDATE_SESSION_ERROR
                : done
                  ? "Your password has been updated."
                  : "Set a new password for your account."}
          </p>
        </div>

        {recoveryStatus === "checking" ? (
          <p
            role="status"
            className="text-sm text-[var(--color-text-secondary)]"
          >
            Please wait.
          </p>
        ) : recoveryStatus === "invalid" ? (
          <Button
            type="button"
            size="lg"
            className="h-11 w-full rounded-xl"
            onClick={onRequestNewLink}
          >
            Request a new reset link
          </Button>
        ) : done ? (
          <Button
            type="button"
            size="lg"
            className="h-11 w-full rounded-xl"
            onClick={onComplete}
          >
            Go to login
          </Button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              <div>
                <label
                  htmlFor={passwordId}
                  className="mb-1.5 block text-sm font-medium text-[var(--color-text-primary)]"
                >
                  New password
                </label>
                <input
                  id={passwordId}
                  type="password"
                  placeholder={t("auth.password.placeholder", {
                    count: PASSWORD_MIN_LENGTH,
                  })}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-soft)]"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                />
                <p className="mt-1.5 text-xs text-[var(--color-text-secondary)]">
                  {t("auth.password.requirements", {
                    count: PASSWORD_MIN_LENGTH,
                  })}
                </p>
              </div>

              <div>
                <label
                  htmlFor={confirmId}
                  className="mb-1.5 block text-sm font-medium text-[var(--color-text-primary)]"
                >
                  Confirm password
                </label>
                <input
                  id={confirmId}
                  type="password"
                  placeholder="Re-enter your new password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-soft)]"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              size="lg"
              className="h-11 w-full rounded-xl"
            >
              {isLoading ? "Updating..." : "Update password"}
            </Button>
          </form>
        )}

        {errorMessage ? (
          <p
            role="alert"
            className="rounded-lg border border-[var(--color-danger)]/25 bg-[var(--color-danger-soft)] px-3.5 py-2.5 text-sm text-[var(--color-danger)]"
          >
            {errorMessage}
          </p>
        ) : null}
      </section>
    </main>
  )
}
