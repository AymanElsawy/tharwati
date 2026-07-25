import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "./types"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be configured",
  )
}

export type TypedSupabaseClient = SupabaseClient<Database>

export const supabase: TypedSupabaseClient = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
)
