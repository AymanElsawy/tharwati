import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { signIn } from "./auth.service"

export function LoginPage() {
  const navigate = useNavigate()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setIsLoading(true)
      setMessage("")

      await signIn(email, password)

      navigate("/dashboard")
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Login failed"
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-4 py-8 sm:px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm sm:p-6"
      >
        <h1 className="text-2xl font-bold">Login</h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2.5"
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2.5"
          required
        />

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-[var(--color-primary)] px-3 py-2.5 text-[var(--color-text-on-primary)] disabled:opacity-50"
        >
          {isLoading ? "Logging in..." : "Login"}
        </button>

        {message && <p className="text-sm text-[var(--color-danger)]">{message}</p>}

        <button
          type="button"
          onClick={() => navigate("/signup")}
          className="w-full underline"
        >
          Create a new account
        </button>
      </form>
    </main>
  )
}
