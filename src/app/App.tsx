import { useEffect, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom"

import { supabase } from "../lib/supabase"
import { LoginPage } from "../features/auth/LoginPage"
import { SignUpPage } from "../features/auth/SignUpPage"
import { ProtectedRoute } from "../components/ProtectedRoute"
import { DashboardLayout } from "../layouts/DashboardLayout"
import { DashboardPage } from "../pages/DashboardPage"
import { PortfolioPage } from "../pages/PortfolioPage"
import { GoalsPage } from "../pages/GoalsPage"
import { NotFoundPage } from "../pages/NotFoundPage"

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      setSession(session)
      setIsLoading(false)
    }

    loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession)
      setIsLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </main>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            session ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <LoginPage />
            )
          }
        />

        <Route
          path="/signup"
          element={
            session ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <SignUpPage />
            )
          }
        />

        <Route
          element={
            <ProtectedRoute session={session}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/goals" element={<GoalsPage />} />
        </Route>

        <Route
          path="/"
          element={
            <Navigate
              to={session ? "/dashboard" : "/login"}
              replace
            />
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}