import { supabase } from "@/lib/supabase"
import { requireQueryData } from "@/lib/supabase/repository"

export async function getCurrentUserProfile(userId: string) {
  const operation = "profile.getCurrentUser"
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", userId)
    .single()

  return requireQueryData(data, error, operation)
}
