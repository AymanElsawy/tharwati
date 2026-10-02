import { useId, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  getPasswordUpdateErrorMessage,
  isWeakPasswordError,
  meetsPasswordRequirements,
  PASSWORD_MIN_LENGTH,
  PASSWORD_UPDATE_SESSION_ERROR,
  updatePassword,
} from "./auth.service"
import { useTranslation } from "@/i18n/useTranslation"

type ResetPasswordPageProps = {
  recoveryStatus: "checking" | "valid" | "invalid"
  /** Called after the password is changed and the recovery session is cleared. */
  onComplete: () => Promise<void> | void
  onCancel: () => Promise<void> | void
  onInvalid: () => void
  onRequestNewLink: () => Promise<void> | void
}

export function ResetPasswordPage({
  recoveryStatus,
  onComplete,
  onCancel,
  onInvalid,
  onRequestNewLink,
}: ResetPasswordPageProps) {
  const { t } = useTranslation()
  const passwordId = useId()
  const confirmId = useId()

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
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
      // Completion/cleanup is a separate outcome from changing the password.
      try {
        await onComplete()
      } catch {
        /* cleanup cannot turn success into failure */
      }
    } catch (error) {
      if (
        getPasswordUpdateErrorMessage(error) === PASSWORD_UPDATE_SESSION_ERROR
      )
        onInvalid()
      setErrorMessage(
        isWeakPasswordError(error)
          ? t("auth.password.weak")
          : getPasswordUpdateErrorMessage(error) ===
              PASSWORD_UPDATE_SESSION_ERROR
            ? t("auth.recovery.invalid")
            : t("auth.recovery.updateError")
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
            {t("auth.recovery.title")}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--color-text-secondary)]">
            {recoveryStatus === "checking"
              ? t("auth.recovery.checking")
              : recoveryStatus === "invalid"
                ? t("auth.recovery.invalid")
                : t("auth.recovery.description")}
          </p>
        </div>

        {recoveryStatus === "checking" ? (
          <p
            role="status"
            className="text-sm text-[var(--color-text-secondary)]"
          >
            {t("auth.recovery.checking")}
          </p>
        ) : recoveryStatus === "invalid" ? (
          <Button
            type="button"
            size="lg"
            className="h-11 w-full rounded-xl"
            onClick={onRequestNewLink}
          >
            {t("auth.recovery.newLink")}
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
                  className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-text-primary)] transition outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-soft)]"
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
                  className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-text-primary)] transition outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-soft)]"
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

        <Button
          type="button"
          disabled={isLoading || recoveryStatus === "checking"}
          onClick={() => void onCancel()}
        >
          {t("auth.recovery.cancel")}
        </Button>
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
