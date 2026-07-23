import type { ReactNode } from "react"
import type { Session } from "@supabase/supabase-js"
import { Navigate } from "react-router-dom"

type ProtectedRouteProps = {
  session: Session | null
  children: ReactNode
}

export function ProtectedRoute({
  session,
  children,
}: ProtectedRouteProps) {
  if (!session) {
    return <Navigate to="/login" replace />
  }

  return children
}