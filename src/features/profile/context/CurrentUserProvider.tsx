import { useEffect, useMemo, useState, type ReactNode } from "react"
import type { User } from "@supabase/supabase-js"

import {
  CurrentUserContext,
  type GreetingType,
} from "@/features/profile/context/CurrentUserContext"
import { getCurrentUserProfile } from "@/features/profile/repositories/profile.repository"
import { RepositoryError } from "@/lib/supabase/types"

interface CurrentUserProviderProps {
  children: ReactNode
  user: User
}

function getTimeGreeting(): Exclude<GreetingType, "welcome"> {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return "morning"
  if (hour >= 12 && hour < 17) return "afternoon"
  return "evening"
}

const greetingLabels = {
  morning: "Good morning",
  afternoon: "Good afternoon",
  evening: "Good evening",
} as const

export function CurrentUserProvider({
  children,
  user,
}: CurrentUserProviderProps) {
  const [profile, setProfile] = useState<{
    full_name: string | null
    avatar_url: string | null
  } | null>(null)
  const [error, setError] = useState<RepositoryError | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [timeGreeting] = useState(getTimeGreeting)

  useEffect(() => {
    let isActive = true

    async function loadProfile() {
      setIsLoading(true)
      try {
        const nextProfile = await getCurrentUserProfile(user.id)
        if (isActive) {
          setProfile(nextProfile)
          setError(null)
        }
      } catch (profileError) {
        if (isActive) {
          setError(
            profileError instanceof RepositoryError
              ? profileError
              : new RepositoryError({
                  code: "database_error",
                  message: "Your profile could not be loaded",
                  operation: "profile.getCurrentUser",
                  cause: profileError,
                }),
          )
        }
      } finally {
        if (isActive) setIsLoading(false)
      }
    }

    void loadProfile()
    return () => {
      isActive = false
    }
  }, [user.id])

  const value = useMemo(() => {
    const fullName = profile?.full_name?.trim() || null
    const firstName = fullName?.split(/\s+/)[0] ?? null
    const email = user.email ?? ""
    const fallback = (firstName?.[0] ?? email[0] ?? "U").toLocaleUpperCase()
    const greetingType: GreetingType = fullName ? timeGreeting : "welcome"

    return {
      fullName,
      firstName,
      email,
      avatar: {
        url: profile?.avatar_url ?? null,
        fallback,
      },
      greeting:
        greetingType === "welcome"
          ? "Welcome back 👋"
          : `${greetingLabels[greetingType]}, ${firstName} 👋`,
      greetingType,
      isLoading,
      error,
    }
  }, [error, isLoading, profile, timeGreeting, user.email])

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>
}
