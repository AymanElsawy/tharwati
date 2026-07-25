import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

export default function WelcomePage() {
  const navigate = useNavigate()

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--color-background)] px-4 py-12 sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,var(--color-primary-soft),transparent_48%)] opacity-70"
      />

      <section
        aria-labelledby="welcome-title"
        className="tharwati-card relative w-full max-w-2xl px-6 py-8 text-center sm:px-12 sm:py-12"
      >
        <div className="mx-auto mb-10 max-w-sm text-start">
          <p className="mb-3 text-sm font-semibold tracking-wide text-[var(--color-primary)]">
            Step 1 of 5
          </p>
          <Progress value={20} aria-label="Onboarding progress: step 1 of 5" />
        </div>

        <div className="mx-auto max-w-xl">
          <h1
            id="welcome-title"
            className="text-3xl font-bold tracking-tight text-[var(--color-text)] sm:text-4xl md:text-5xl"
          >
            Welcome to Tharwati
          </h1>
          <p className="mt-5 text-base leading-7 text-[var(--color-text-secondary)] sm:text-lg sm:leading-8">
            Build a clear picture of your wealth, track your goals, and receive personalized
            financial insights based on your own data.
          </p>
        </div>

        <Button
          type="button"
          size="lg"
          className="mt-10 h-12 w-full rounded-xl px-8 text-base sm:w-auto sm:min-w-40"
          onClick={() => navigate("/onboarding/country")}
        >
          Continue
        </Button>
      </section>
    </main>
  )
}
