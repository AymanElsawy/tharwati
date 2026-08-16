import { useId, useState } from "react"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { signUp } from "./auth.service"

export function SignUpPage() {
  const navigate = useNavigate()
  const emailId = useId()
  const passwordId = useId()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [infoMessage, setInfoMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setIsLoading(true)
      setErrorMessage("")
      setInfoMessage("")

      const { session } = await signUp(email, password)

      if (session) {
        navigate("/onboarding")
      } else {
        setInfoMessage("Check your email to confirm your account, then log in.")
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Signup failed")
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
            Create account
          </h1>
          <p className="mt-1.5 text-sm text-[var(--color-text-secondary)]">
            Start building your personalized wealth workspace.
          </p>
        </div>

        <div className="space-y-4">
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

          <div>
            <label
              htmlFor={passwordId}
              className="mb-1.5 block text-sm font-medium text-[var(--color-text-primary)]"
            >
              Password
            </label>
            <input
              id={passwordId}
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-soft)]"
              required
              minLength={6}
            />
          </div>
        </div>

        <Button type="submit" disabled={isLoading} size="lg" className="h-11 w-full rounded-xl">
          {isLoading ? "Creating account..." : "Create account"}
        </Button>

        {errorMessage ? (
          <p
            role="alert"
            className="rounded-lg border border-[var(--color-danger)]/25 bg-[var(--color-danger-soft)] px-3.5 py-2.5 text-sm text-[var(--color-danger)]"
          >
            {errorMessage}
          </p>
        ) : null}

        {infoMessage ? (
          <p
            role="status"
            className="rounded-lg border border-[var(--color-primary)]/25 bg-[var(--color-primary-soft)] px-3.5 py-2.5 text-sm text-[var(--color-primary)]"
          >
            {infoMessage}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => navigate("/login")}
          className="w-full text-center text-sm font-medium text-[var(--color-text-secondary)] underline-offset-4 hover:text-[var(--color-primary)] hover:underline"
        >
          Already have an account? Login
        </button>
      </form>
    </main>
  )
}
