import type { Session } from "@supabase/supabase-js"

/** Preserve mounted authenticated UI across token refresh/focus notifications. */
export function canPreserveAuthenticatedTree(
  currentUserId: string | null,
  nextSession: Session | null,
): boolean {
  return currentUserId !== null && nextSession?.user.id === currentUserId
}
