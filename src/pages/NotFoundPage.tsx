import { Link } from "react-router-dom"

export function NotFoundPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">404</h1>

      <p>Page not found.</p>

      <Link
        to="/dashboard"
        className="rounded bg-black px-4 py-2 text-white"
      >
        Go to dashboard
      </Link>
    </main>
  )
}