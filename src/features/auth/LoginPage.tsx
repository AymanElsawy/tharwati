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
    <main className="min-h-screen flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 border p-6 rounded-lg"
      >
        <h1 className="text-2xl font-bold">Login</h1>

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
        />

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-black text-white rounded px-3 py-2 disabled:opacity-50"
        >
          {isLoading ? "Logging in..." : "Login"}
        </button>

        {message && <p>{message}</p>}

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