import { createContext } from "react"

import type { RepositoryError } from "@/lib/supabase/types"

export type GreetingType = "morning" | "afternoon" | "evening" | "welcome"

export interface CurrentUserValue {
  avatar: {
    fallback: string
    url: string | null
  }
  baseCurrencyCode: string | null
  email: string
  error: RepositoryError | null
  firstName: string | null
  fullName: string | null
  greeting: string
  greetingType: GreetingType
  isLoading: boolean
  refreshProfile: () => Promise<void>
}

export const CurrentUserContext = createContext<CurrentUserValue | null>(null)
