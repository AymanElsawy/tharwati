import { useCallback, useEffect, useRef, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from "react-router-dom"

import { supabase } from "../lib/supabase"
import { LoginPage } from "../features/auth/LoginPage"
import { SignUpPage } from "../features/auth/SignUpPage"
import { AccountsPage } from "../features/accounts/pages/AccountsPage"
import { AccountRecordsPage } from "../features/accounts/pages/AccountRecordsPage"
import { AccountDetailsPage } from "../features/accounts/pages/AccountDetailsPage"
import CountryPage from "../features/onboarding/pages/CountryPage"
import CurrencyPage from "../features/onboarding/pages/CurrencyPage"
import OnboardingGoalsPage from "../features/onboarding/pages/GoalsPage"
import ReadyPage from "../features/onboarding/pages/ReadyPage"
import WelcomePage from "../features/onboarding/pages/WelcomePage"
import { OnboardingProvider } from "../features/onboarding/context/OnboardingProvider"
import { getOnboardingCompletion } from "../features/onboarding/repositories/onboarding.repository"
import { CurrentUserProvider } from "../features/profile/context/CurrentUserProvider"
import { ProtectedRoute } from "../components/ProtectedRoute"
import { DashboardLayout } from "../layouts/DashboardLayout"
import { DashboardPage } from "../pages/DashboardPage"
import { DesignLabPage } from "../pages/DesignLabPage"
import { NotFoundPage } from "../pages/NotFoundPage"
import { useTranslation } from "../i18n/useTranslation"
import { canPreserveAuthenticatedTree } from "../features/auth/auth-session-lifecycle"

export default function App() {
  const { t } = useTranslation()
  const [session, setSession] = useState<Session | null>(null)
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [startupError, setStartupError] = useState<string | null>(null)
  const authenticatedUserId = useRef<string | null>(null)

  const resolveSession = useCallback(async (currentSession: Session | null) => {
    setSession(currentSession)
    authenticatedUserId.current = currentSession?.user.id ?? null
    setStartupError(null)

    if (!currentSession) {
      setOnboardingCompleted(null)
      setIsLoading(false)
      return
    }

    try {
      setOnboardingCompleted(await getOnboardingCompletion())
    } catch (error) {
      setStartupError(
        error instanceof Error
          ? error.message
          : "We couldn't load your account. Please try again.",
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    async function loadSession() {
      const { data, error } = await supabase.auth.getSession()

      if (error) {
        setStartupError(error.message)
        setIsLoading(false)
        return
      }

      await resolveSession(data.session)
    }

    void loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (
        canPreserveAuthenticatedTree(authenticatedUserId.current, currentSession)
      ) {
        setSession(currentSession)
        return
      }
      setIsLoading(true)
      void resolveSession(currentSession)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [resolveSession])

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>{t("common.loading")}</p>
      </main>
    )
  }

  if (startupError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-4">
        <div className="tharwati-card max-w-md p-8 text-center">
          <h1 className="text-xl font-semibold text-[var(--color-text)]">
            We couldn&apos;t load your account
          </h1>
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
            {startupError}
          </p>
          <button
            type="button"
            className="tharwati-button-primary mt-6"
            onClick={() => {
              setIsLoading(true)
              void resolveSession(session)
            }}
          >
            Try again
          </button>
        </div>
      </main>
    )
  }

  const authenticatedDestination = onboardingCompleted ? "/dashboard" : "/onboarding"

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            session ? (
              <Navigate to={authenticatedDestination} replace />
            ) : (
              <LoginPage />
            )
          }
        />

        <Route
          path="/signup"
          element={
            session ? (
              <Navigate to={authenticatedDestination} replace />
            ) : (
              <SignUpPage />
            )
          }
        />

        <Route
          path="/onboarding"
          element={
            session ? (
              <OnboardingProvider
                onCompleted={() => setOnboardingCompleted(true)}
              >
                <Outlet />
              </OnboardingProvider>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route index element={<WelcomePage />} />
          <Route path="country" element={<CountryPage />} />
          <Route path="currency" element={<CurrencyPage />} />
          <Route path="goals" element={<OnboardingGoalsPage />} />
          <Route path="ready" element={<ReadyPage />} />
        </Route>

        <Route
          element={
            <ProtectedRoute session={session}>
              {onboardingCompleted ? (
                <CurrentUserProvider user={session!.user}>
                  <DashboardLayout />
                </CurrentUserProvider>
              ) : (
                <Navigate to="/onboarding" replace />
              )}
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/accounts/:accountId" element={<AccountDetailsPage />} />
          <Route path="/accounts/:accountId/records" element={<AccountRecordsPage />} />
          <Route path="/design-lab" element={<DesignLabPage />} />
        </Route>

        <Route
          path="/"
          element={
            <Navigate
              to={session ? authenticatedDestination : "/login"}
              replace
            />
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
