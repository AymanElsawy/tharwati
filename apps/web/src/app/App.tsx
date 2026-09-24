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
import { ForgotPasswordPage } from "../features/auth/ForgotPasswordPage"
import { ResetPasswordPage } from "../features/auth/ResetPasswordPage"
import { AccountsPage } from "../features/accounts/pages/AccountsPage"
import { AccountRecordsPage } from "../features/accounts/pages/AccountRecordsPage"
import { AccountDetailsPage } from "../features/accounts/pages/AccountDetailsPage"
import { MetalPurityDetailsPage } from "../features/accounts/pages/MetalPurityDetailsPage"
import { BrokerageHoldingDetailsPage } from "../features/accounts/pages/BrokerageHoldingDetailsPage"
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
import { GoalsPage } from "../features/goals/pages/GoalsPage"
import { DashboardPage } from "../pages/DashboardPage"
import { AnalysisPage } from "../pages/AnalysisPage"
import { PortfolioPage } from "../pages/PortfolioPage"
import { DesignLabPage } from "../pages/DesignLabPage"
import { NotFoundPage } from "../pages/NotFoundPage"
import { useTranslation } from "../i18n/useTranslation"
import { canPreserveAuthenticatedTree } from "../features/auth/auth-session-lifecycle"
import { SettingsPage } from "../features/settings/pages/SettingsPage"
import { type StartupStage, withStartupTimeout } from "./startup-state"

export default function App() {
  const { t } = useTranslation()
  const [session, setSession] = useState<Session | null>(null)
  const [onboardingCompleted, setOnboardingCompleted] = useState<
    boolean | null
  >(null)
  const [startupStage, setStartupStage] =
    useState<StartupStage>("reading-session")
  // Recognise the recovery link synchronously so the router never gets a chance
  // to route the freshly-created session into the authenticated app.
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(
    () =>
      typeof window !== "undefined" &&
      window.location.pathname === "/reset-password",
  )
  const [recoveryStatus, setRecoveryStatus] = useState<
    "checking" | "valid" | "invalid"
  >("checking")
  const authenticatedUserId = useRef<string | null>(null)

  const resolveAccount = useCallback(async (currentSession: Session | null) => {
    setSession(currentSession)
    authenticatedUserId.current = currentSession?.user.id ?? null

    if (!currentSession) {
      setOnboardingCompleted(null)
      setStartupStage("ready")
      return
    }

    setStartupStage("reading-account")
    try {
      setOnboardingCompleted(
        await withStartupTimeout(getOnboardingCompletion()),
      )
      setStartupStage("ready")
    } catch {
      setStartupStage("failed-account")
    }
  }, [])

  const loadSession = useCallback(async () => {
    setStartupStage("reading-session")
    try {
      const { data, error } = await withStartupTimeout(
        supabase.auth.getSession(),
      )
      if (error) throw error
      await resolveAccount(data.session)
      setRecoveryStatus((current) =>
        current === "valid" ? current : "invalid",
      )
    } catch {
      setRecoveryStatus("invalid")
      setStartupStage("failed-session")
    }
  }, [resolveAccount])

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) void loadSession()
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (event === "PASSWORD_RECOVERY") {
        // The recovery link creates a session; hold the app on the reset form
        // instead of routing the user into the authenticated app.
        setIsPasswordRecovery(true)
        setRecoveryStatus(currentSession ? "valid" : "invalid")
        setSession(currentSession)
        authenticatedUserId.current = currentSession?.user.id ?? null
        setStartupStage("ready")
        return
      }
      if (
        canPreserveAuthenticatedTree(
          authenticatedUserId.current,
          currentSession
        )
      ) {
        setSession(currentSession)
        return
      }
      void resolveAccount(currentSession)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [loadSession, resolveAccount])

  if (isPasswordRecovery) {
    return (
      <ResetPasswordPage
        recoveryStatus={recoveryStatus}
        onComplete={() => {
          setIsPasswordRecovery(false)
          setSession(null)
          authenticatedUserId.current = null
          window.location.assign("/login")
        }}
        onRequestNewLink={() => window.location.assign("/forgot-password")}
      />
    )
  }

  if (
    startupStage === "reading-session" ||
    startupStage === "reading-account"
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p>{t("common.loading")}</p>
      </main>
    )
  }

  if (
    startupStage === "failed-session" ||
    startupStage === "failed-account"
  ) {
    const failedSession = startupStage === "failed-session"
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-4">
        <div className="tharwati-card max-w-md p-8 text-center">
          <h1 className="text-xl font-semibold text-[var(--color-text)]">
            {t(failedSession ? "startup.connection.title" : "startup.account.title")}
          </h1>
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
            {t("startup.safeMessage")}
          </p>
          <button
            type="button"
            className="tharwati-button-primary mt-6"
            onClick={() => {
              if (failedSession) void loadSession()
              else void resolveAccount(session)
            }}
          >
            {t("startup.retry")}
          </button>
          {!failedSession && session ? (
            <button
              type="button"
              className="tharwati-button-secondary mt-3"
              onClick={() => void supabase.auth.signOut()}
            >
              {t("startup.signOut")}
            </button>
          ) : null}
        </div>
      </main>
    )
  }

  const authenticatedDestination = onboardingCompleted
    ? "/dashboard"
    : "/onboarding"

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
          path="/forgot-password"
          element={
            session ? (
              <Navigate to={authenticatedDestination} replace />
            ) : (
              <ForgotPasswordPage />
            )
          }
        />

        <Route
          path="/reset-password"
          element={<Navigate to="/login" replace />}
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
                <CurrentUserProvider key={session!.user.id} user={session!.user}>
                  <DashboardLayout />
                </CurrentUserProvider>
              ) : (
                <Navigate to="/onboarding" replace />
              )}
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route
            path="/accounts/:accountId/purities/:purity"
            element={<MetalPurityDetailsPage />}
          />
          <Route
            path="/accounts/:accountId/holdings/:assetId"
            element={<BrokerageHoldingDetailsPage />}
          />
          <Route path="/accounts/:accountId" element={<AccountDetailsPage />} />
          <Route
            path="/accounts/:accountId/records"
            element={<AccountRecordsPage />}
          />
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
