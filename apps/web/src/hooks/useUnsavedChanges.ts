import { useCallback, useEffect, useState } from "react"

export function useUnsavedChanges(isDirty: boolean) {
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  useEffect(() => {
    if (!isDirty) return
    const preventUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", preventUnload)
    return () => window.removeEventListener("beforeunload", preventUnload)
  }, [isDirty])
  const request = useCallback((action: () => void) => {
    if (!isDirty) return action()
    setPendingAction(() => action)
    setConfirmationOpen(true)
  }, [isDirty])
  const discard = useCallback(() => {
    setConfirmationOpen(false)
    const action = pendingAction
    setPendingAction(null)
    action?.()
  }, [pendingAction])
  return { confirmationOpen, request, keepEditing: () => setConfirmationOpen(false), discard }
}
