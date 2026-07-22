import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/")({
  component: HomePage,
})

function HomePage() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold">Tharwati</h1>
      <p className="mt-2 text-muted-foreground">
        Personal Wealth Manager
      </p>
    </main>
  )
}