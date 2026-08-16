import { holdingsRepository } from "@/features/holdings/repositories/holdings.repository"
import type {
  PortfolioValuationRepositoryContract,
  PortfolioValuationSource,
} from "@/features/portfolio-valuation/types/portfolio-valuation"
import {
  supabase,
  type TypedSupabaseClient,
} from "@/lib/supabase/client"
import {
  requireAuthenticatedUserId,
  requireQueryData,
} from "@/lib/supabase/repository"
import { RepositoryError } from "@/lib/supabase/types"

interface OpenHoldingsReader {
  getHoldings(): PortfolioValuationSource["holdings"] | Promise<
    PortfolioValuationSource["holdings"]
  >
}

export class PortfolioValuationRepository
  implements PortfolioValuationRepositoryContract
{
  private readonly client: TypedSupabaseClient
  private readonly holdings: OpenHoldingsReader

  constructor(
    client: TypedSupabaseClient = supabase,
    holdings: OpenHoldingsReader = holdingsRepository,
  ) {
    this.client = client
    this.holdings = holdings
  }

  async getSource(): Promise<PortfolioValuationSource> {
    const operation = "portfolioValuation.getSource"
    const userId = await requireAuthenticatedUserId(
      this.client,
      operation,
    )
    const [holdings, profileResult] = await Promise.all([
      this.holdings.getHoldings(),
      this.client
        .from("profiles")
        .select("base_currency_code")
        .eq("id", userId)
        .single(),
    ])
    const profile = requireQueryData(
      profileResult.data,
      profileResult.error,
      operation,
    )
    if (profile.base_currency_code === null) {
      throw new RepositoryError({
        code: "not_found",
        message: "The user has not completed onboarding",
        operation,
      })
    }
    return {
      baseCurrency: profile.base_currency_code,
      holdings,
    }
  }
}

export const portfolioValuationRepository =
  new PortfolioValuationRepository()
