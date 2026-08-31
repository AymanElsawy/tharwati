import { useId, useState } from "react"

import { Button } from "@/components/ui/button"
import { signOut, updatePassword } from "./auth.service"

const MIN_PASSWORD_LENGTH = 8

type ResetPasswordPageProps = {
  /** Called after the password is changed and the recovery session is cleared. */
  onComplete: () => void
}

export function ResetPasswordPage({ onComplete }: ResetPasswordPageProps) {
  const passwordId = useId()
  const confirmId = useId()

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [done, setDone] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (password !== confirm) {
      setErrorMessage("The two passwords don't match.")
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
        "We couldn't update your password. The reset link may have expired — request a new one.",
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

      <form
        onSubmit={handleSubmit}
        className="tharwati-card relative w-full max-w-sm space-y-5 px-6 py-8 sm:px-8"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Choose a new password
          </h1>
          <p className="mt-1.5 text-sm text-[var(--color-text-secondary)]">
            {done
              ? "Your password has been updated."
              : "Set a new password for your account."}
          </p>
        </div>

        {done ? (
          <Button
            type="button"
            size="lg"
            className="h-11 w-full rounded-xl"
            onClick={onComplete}
          >
            Go to login
          </Button>
        ) : (
          <>
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
                  placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-soft)]"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                />
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
                  minLength={MIN_PASSWORD_LENGTH}
                />
              </div>
            </div>

            <Button type="submit" disabled={isLoading} size="lg" className="h-11 w-full rounded-xl">
              {isLoading ? "Updating..." : "Update password"}
            </Button>
          </>
        )}

        {errorMessage ? (
          <p
            role="alert"
            className="rounded-lg border border-[var(--color-danger)]/25 bg-[var(--color-danger-soft)] px-3.5 py-2.5 text-sm text-[var(--color-danger)]"
          >
            {errorMessage}
          </p>
        ) : null}
      </form>
    </main>
  )
}
