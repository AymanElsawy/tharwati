import { useId, useState } from "react"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { requestPasswordReset } from "./auth.service"

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const emailId = useId()

  const [email, setEmail] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [sent, setSent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setIsLoading(true)
      setErrorMessage("")
      await requestPasswordReset(email)
      setSent(true)
    } catch (error) {
      console.error("password reset request failed", error)
      setErrorMessage("We couldn't send the reset email. Please try again.")
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
            Reset your password
          </h1>
          <p className="mt-1.5 text-sm text-[var(--color-text-secondary)]">
            Enter your email and we&apos;ll send you a link to set a new password.
          </p>
        </div>

        {sent ? (
          <p
            role="status"
            className="rounded-lg border border-[var(--color-primary)]/25 bg-[var(--color-primary-soft)] px-3.5 py-2.5 text-sm text-[var(--color-primary)]"
          >
            If an account exists for {email.trim()}, a reset link is on its way.
            Check your inbox and spam folder.
          </p>
        ) : (
          <div>
            <label
              htmlFor={emailId}
              className="mb-1.5 block text-sm font-medium text-[var(--color-text-primary)]"
            >
              Email
            </label>
            <input
              id={emailId}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-soft)]"
              required
            />
          </div>
        )}

        {!sent ? (
          <Button type="submit" disabled={isLoading} size="lg" className="h-11 w-full rounded-xl">
            {isLoading ? "Sending..." : "Send reset link"}
          </Button>
        ) : null}

        {errorMessage ? (
          <p
            role="alert"
            className="rounded-lg border border-[var(--color-danger)]/25 bg-[var(--color-danger-soft)] px-3.5 py-2.5 text-sm text-[var(--color-danger)]"
          >
            {errorMessage}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => navigate("/login")}
          className="w-full text-center text-sm font-medium text-[var(--color-text-secondary)] underline-offset-4 hover:text-[var(--color-primary)] hover:underline"
        >
          Back to login
        </button>
      </form>
    </main>
  )
}
