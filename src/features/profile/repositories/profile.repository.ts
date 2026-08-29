import { supabase } from "@/lib/supabase"
import {
  requireAuthenticatedUserId,
  requireQueryData,
} from "@/lib/supabase/repository"

export async function getCurrentUserProfile(userId: string) {
  const operation = "profile.getCurrentUser"
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, base_currency_code")
    .eq("id", userId)
    .single()

  return requireQueryData(data, error, operation)
}

export async function getCurrentUserBaseCurrency() {
  const operation = "profile.getBaseCurrency"
  const userId = await requireAuthenticatedUserId(supabase, operation)
  const { data, error } = await supabase
    .from("profiles")
    .select("base_currency_code")
    .eq("id", userId)
    .single()

  return requireQueryData(data, error, operation).base_currency_code
}
