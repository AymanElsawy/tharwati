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
    <main className="min-h-screen flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 border p-6 rounded-lg"
      >
        <h1 className="text-2xl font-bold">Create account</h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full border rounded px-3 py-2"
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full border rounded px-3 py-2"
          required
          minLength={6}
        />

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-black text-white rounded px-3 py-2 disabled:opacity-50"
        >
          {isLoading ? "Creating account..." : "Create account"}
        </button>

        {message && <p>{message}</p>}

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