import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "./types"

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey?.startsWith("sb_publishable_")) {
  throw new Error(
    "VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be configured",
  )
}

export type TypedSupabaseClient = SupabaseClient<Database>

export const supabase: TypedSupabaseClient = createClient<Database>(
  supabaseUrl,
  supabasePublishableKey,
)
