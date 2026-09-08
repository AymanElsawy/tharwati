import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import type { User } from "@supabase/supabase-js"

import {
  CurrentUserContext,
  type GreetingType,
} from "@/features/profile/context/CurrentUserContext"
import { getCurrentUserProfile } from "@/features/profile/repositories/profile.repository"
import { RepositoryError } from "@/lib/supabase/types"
import { ProfileRequestGuard } from "./profile-request-guard"

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
    base_currency_code: string | null
  } | null>(null)
  const [error, setError] = useState<RepositoryError | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [timeGreeting] = useState(getTimeGreeting)
  const isMountedRef = useRef(true)
  const requestGuardRef = useRef(new ProfileRequestGuard(user.id))

  const refreshProfile = useCallback(async () => {
    const request = requestGuardRef.current.begin(user.id)
    setIsLoading(true)
    try {
      const nextProfile = await getCurrentUserProfile(user.id)
      if (!isMountedRef.current || !requestGuardRef.current.isCurrent(request)) return
      setProfile(nextProfile)
      setError(null)
    } catch (profileError) {
      if (!isMountedRef.current || !requestGuardRef.current.isCurrent(request)) return
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
      throw profileError
    } finally {
      if (isMountedRef.current && requestGuardRef.current.isCurrent(request)) setIsLoading(false)
    }
  }, [user.id])

  useEffect(() => {
    const guard = requestGuardRef.current
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      guard.invalidate()
    }
  }, [])

  useEffect(() => {
    const guard = requestGuardRef.current
    guard.setActiveUser(user.id)
    async function loadInitialProfile() {
      await refreshProfile().catch(() => undefined)
    }

    void loadInitialProfile()
    return () => guard.invalidate()
  }, [refreshProfile, user.id])

  const value = useMemo(() => {
    const fullName = profile?.full_name?.trim() || null
    const firstName = fullName?.split(/\s+/)[0] ?? null
    const email = user.email ?? ""
    const fallback = (firstName?.[0] ?? email[0] ?? "U").toLocaleUpperCase()
    const greetingType: GreetingType = fullName ? timeGreeting : "welcome"

    return {
      baseCurrencyCode: profile?.base_currency_code ?? null,
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
      refreshProfile,
      error,
    }
  }, [error, isLoading, profile, refreshProfile, timeGreeting, user.email])

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>
}
