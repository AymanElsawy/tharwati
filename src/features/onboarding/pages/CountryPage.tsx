import { ArrowLeft } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { CountrySelector } from "@/features/onboarding/components/CountrySelector"
import { getDefaultCurrencyCode } from "@/features/onboarding/data/country-currency"
import { findCurrency } from "@/features/onboarding/data/currencies"
import { useOnboarding } from "@/features/onboarding/hooks/useOnboarding"

export default function CountryPage() {
  const navigate = useNavigate()
  const { country, setCountry, setCurrency } = useOnboarding()

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--color-background)] px-4 py-12 sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,var(--color-primary-soft),transparent_48%)] opacity-70"
      />

      <section
        aria-labelledby="country-title"
        className="tharwati-card relative w-full max-w-2xl px-6 py-8 sm:px-12 sm:py-12"
      >
        <div className="mx-auto max-w-xl">
          <div className="mb-10">
            <p className="mb-3 text-sm font-semibold tracking-wide text-[var(--color-primary)]">
              Step 2 of 5
            </p>
            <Progress value={40} aria-label="Onboarding progress: step 2 of 5" />
          </div>

          <div className="text-center">
            <h1
              id="country-title"
              className="text-3xl font-bold tracking-tight text-[var(--color-text)] sm:text-4xl"
            >
              Where do you currently live?
            </h1>
            <p className="mt-4 text-base leading-7 text-[var(--color-text-secondary)] sm:text-lg">
              This helps personalize your experience, currency defaults, and future financial
              insights.
            </p>
          </div>

          <div className="mt-9">
            <CountrySelector
              value={country}
              onChange={(nextCountry) => {
                setCountry(nextCountry)
                setCurrency(
                  nextCountry
                    ? findCurrency(getDefaultCurrencyCode(nextCountry.code))
                    : null,
                )
              }}
            />
          </div>

          <div className="mt-10 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 rounded-xl px-6 text-base"
              onClick={() => navigate("/onboarding")}
            >
              <ArrowLeft aria-hidden="true" />
              Back
            </Button>
            <Button
              type="button"
              size="lg"
              disabled={!country}
              className="h-12 rounded-xl px-8 text-base sm:min-w-40"
              onClick={() => navigate("/onboarding/currency")}
            >
              Continue
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
