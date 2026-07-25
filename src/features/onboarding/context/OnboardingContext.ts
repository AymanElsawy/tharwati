import { createContext } from "react"

import type { CountryOption } from "@/features/onboarding/components/CountrySelector"
import type { CurrencyOption } from "@/features/onboarding/data/currencies"

export interface OnboardingState {
  country: CountryOption | null
  currency: CurrencyOption | null
  goals: string[]
  answers: Record<string, unknown>
}

export interface OnboardingContextValue extends OnboardingState {
  completeOnboarding: () => Promise<void>
  setCountry: (country: CountryOption | null) => void
  setCurrency: (currency: CurrencyOption | null) => void
  setGoals: (goals: string[]) => void
  setAnswers: (answers: Record<string, unknown>) => void
}

export const OnboardingContext = createContext<OnboardingContextValue | null>(null)
