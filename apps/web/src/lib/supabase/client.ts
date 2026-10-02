import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "./types"
import {
  callbackMatchesProject,
  hasRecoveryOrigin,
  RecoveryLifecycle,
} from "../../features/auth/recovery-lifecycle"

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey?.startsWith("sb_publishable_")) {
  throw new Error(
    "VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be configured"
  )
}

export type TypedSupabaseClient = SupabaseClient<Database>

const callbackLocation =
  typeof window === "undefined" ? undefined : window.location
const markerStorage =
  typeof window === "undefined"
    ? { getItem: () => null, setItem: () => {}, removeItem: () => {} }
    : window.localStorage
export const recoveryLifecycle = new RecoveryLifecycle(
  markerStorage,
  supabaseUrl,
  callbackLocation
)
const acceptsCallback = callbackMatchesProject(
  callbackLocation?.hash ?? "",
  supabaseUrl
)
if (!acceptsCallback) recoveryLifecycle.rejectCallback()

export const supabase: TypedSupabaseClient = createClient<Database>(
  supabaseUrl,
  supabasePublishableKey,
  { auth: { detectSessionInUrl: acceptsCallback } }
)

// Subscribe before React mounts, so startup cannot lose the recovery event.
supabase.auth.onAuthStateChange((event, session) => {
  recoveryLifecycle.observeSession(session?.access_token)
  recoveryLifecycle.onAuthEvent(
    event,
    Boolean(session),
    hasRecoveryOrigin(session?.access_token)
  )
})
