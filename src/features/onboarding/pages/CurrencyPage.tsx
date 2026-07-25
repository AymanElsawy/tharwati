import { ArrowLeft } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { CurrencySelector } from "@/features/onboarding/components/CurrencySelector"
import { useOnboarding } from "@/features/onboarding/hooks/useOnboarding"

export default function CurrencyPage() {
  const navigate = useNavigate()
  const { currency, setCurrency } = useOnboarding()

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--color-background)] px-4 py-12 sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,var(--color-primary-soft),transparent_48%)] opacity-70"
      />

      <section
        aria-labelledby="currency-title"
        className="tharwati-card relative w-full max-w-2xl px-6 py-8 sm:px-12 sm:py-12"
      >
        <div className="mx-auto max-w-xl">
          <div className="mb-10">
            <p className="mb-3 text-sm font-semibold tracking-wide text-[var(--color-primary)]">
              Step 3 of 5
            </p>
            <Progress value={60} aria-label="Onboarding progress: step 3 of 5" />
          </div>

          <div className="text-center">
            <h1
              id="currency-title"
              className="text-3xl font-bold tracking-tight text-[var(--color-text)] sm:text-4xl"
            >
              Choose your base currency
            </h1>
            <p className="mt-4 text-base leading-7 text-[var(--color-text-secondary)] sm:text-lg">
              Your assets can be added in any currency.
              <br />
              Your base currency is only used to display your total wealth and reports.
            </p>
          </div>

          <div className="mt-9">
            <CurrencySelector value={currency} onChange={setCurrency} />
          </div>

          <div className="mt-10 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 rounded-xl px-6 text-base"
              onClick={() => navigate("/onboarding/country")}
            >
              <ArrowLeft aria-hidden="true" />
              Back
            </Button>
            <Button
              type="button"
              size="lg"
              disabled={!currency}
              className="h-12 rounded-xl px-8 text-base sm:min-w-40"
              onClick={() => navigate("/onboarding/goals")}
            >
              Continue
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
