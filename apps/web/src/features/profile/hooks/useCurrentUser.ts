import { useContext } from "react"

import { CurrentUserContext } from "@/features/profile/context/CurrentUserContext"

export function useCurrentUser() {
  const context = useContext(CurrentUserContext)
  if (!context) {
    throw new Error("useCurrentUser must be used within a CurrentUserProvider")
  }
  return context
}
