import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { signUp } from "./auth.service"

export function SignUpPage() {
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

      await signUp(email, password)

      setMessage("Account created successfully")

      // بعد إنشاء الحساب نرجع المستخدم لصفحة تسجيل الدخول
      navigate("/login")
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Signup failed"
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
        <h1 className="text-2xl font-bold">Create account</h1>

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
          minLength={6}
        />

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-[var(--color-primary)] px-3 py-2.5 text-[var(--color-text-on-primary)] disabled:opacity-50"
        >
          {isLoading ? "Creating account..." : "Create account"}
        </button>

        {message && <p className="text-sm text-[var(--color-danger)]">{message}</p>}

        <button
          type="button"
          onClick={() => navigate("/login")}
          className="w-full underline"
        >
          Already have an account? Login
        </button>
      </form>
    </main>
  )
}
