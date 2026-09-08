import { useState } from "react"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useOnboarding } from "@/features/onboarding/hooks/useOnboarding"

export default function ReadyPage() {
  const navigate = useNavigate()
  const { completeOnboarding } = useOnboarding()
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleComplete() {
    setIsSaving(true)
    setErrorMessage(null)

    try {
      await completeOnboarding()
      navigate("/dashboard", { replace: true })
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We couldn't save your onboarding preferences. Please try again.",
      )
      setIsSaving(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--color-background)] px-4 py-12 sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,var(--color-primary-soft),transparent_48%)] opacity-70"
      />

      <section
        aria-labelledby="ready-title"
        className="tharwati-card relative w-full max-w-2xl px-6 py-8 text-center sm:px-12 sm:py-12"
      >
        <div className="mx-auto mb-10 max-w-sm text-start">
          <p className="mb-3 text-sm font-semibold tracking-wide text-[var(--color-primary)]">
            Step 5 of 5
          </p>
          <Progress value={100} aria-label="Onboarding progress: step 5 of 5" />
        </div>

        <div className="mx-auto max-w-xl">
          <h1
            id="ready-title"
            className="text-3xl font-bold tracking-tight text-[var(--color-text)] sm:text-4xl md:text-5xl"
          >
            You&apos;re all set
          </h1>
          <p className="mt-5 text-lg font-medium leading-8 text-[var(--color-text)]">
            Your personalized wealth workspace is ready.
          </p>
          <p className="mt-3 text-base leading-7 text-[var(--color-text-secondary)] sm:text-lg sm:leading-8">
            We&apos;ll help you track your wealth, monitor your progress, and provide contextual
            financial insights based on your goals.
          </p>
        </div>

        <Button
          type="button"
          size="lg"
          disabled={isSaving}
          className="mt-10 h-12 w-full rounded-xl px-8 text-base sm:w-auto sm:min-w-48"
          onClick={() => void handleComplete()}
        >
          {isSaving ? "Saving..." : "Go to Dashboard"}
        </Button>
        {errorMessage && (
          <p role="alert" className="mt-4 text-sm text-[var(--color-danger)]">
            {errorMessage}
          </p>
        )}
      </section>
    </main>
  )
}
