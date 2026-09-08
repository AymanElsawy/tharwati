import { supabase } from "@/lib/supabase"
import { requireAuthenticatedUserId, requireQueryData } from "@/lib/supabase/repository"
import { toRepositoryError } from "@/lib/supabase/types"

export interface CompleteOnboardingInput {
  countryCode: string
  baseCurrencyCode: string
  selectedGoals: string[]
}

export async function getOnboardingCompletion() {
  const userId = await requireAuthenticatedUserId(
    supabase,
    "onboarding.getCompletion",
  )
  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", userId)
    .single()

  return requireQueryData(data, error, "onboarding.getCompletion")
    .onboarding_completed
}

export async function completeOnboarding(input: CompleteOnboardingInput) {
  const { error } = await supabase.rpc("complete_onboarding", {
    p_country_code: input.countryCode,
    p_base_currency_code: input.baseCurrencyCode,
    p_selected_goals: input.selectedGoals,
  })

  if (error) {
    throw toRepositoryError(error, "onboarding.complete")
  }
}
