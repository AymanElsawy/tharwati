import { useCallback, useMemo, useState, type ReactNode } from "react"

import {
  OnboardingContext,
  type OnboardingState,
} from "@/features/onboarding/context/OnboardingContext"
import { completeOnboarding as saveOnboarding } from "@/features/onboarding/repositories/onboarding.repository"

const initialState: OnboardingState = {
  country: null,
  currency: null,
  goals: [],
  answers: {},
}

interface OnboardingProviderProps {
  children: ReactNode
  onCompleted: () => void
}

export function OnboardingProvider({
  children,
  onCompleted,
}: OnboardingProviderProps) {
  const [country, setCountry] = useState(initialState.country)
  const [currency, setCurrency] = useState(initialState.currency)
  const [goals, setGoals] = useState(initialState.goals)
  const [answers, setAnswers] = useState(initialState.answers)

  const completeOnboarding = useCallback(async () => {
    if (!country || !currency || goals.length === 0) {
      throw new Error("Country, base currency, and at least one goal are required")
    }

    await saveOnboarding({
      countryCode: country.code,
      baseCurrencyCode: currency.code,
      selectedGoals: goals,
    })
    onCompleted()
  }, [country, currency, goals, onCompleted])

  const value = useMemo(
    () => ({
      country,
      currency,
      goals,
      answers,
      completeOnboarding,
      setCountry,
      setCurrency,
      setGoals,
      setAnswers,
    }),
    [answers, completeOnboarding, country, currency, goals],
  )

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>
}
