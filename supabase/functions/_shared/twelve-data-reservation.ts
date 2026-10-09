import { bounded } from "./market-reliability.ts"
import { ProviderBudgetError } from "./provider-budget.ts"

type ReservationClient = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> }

/** One atomic charge per outbound request; returns only the affordable prefix. */
export async function reserveTwelveDataSymbols(client: ReservationClient, requested: number): Promise<number> {
  try {
    const { data, error } = await bounded(750, () => client.rpc("reserve_twelve_data_symbols", { p_requested_symbols: requested }))
    if (error || !data || typeof data !== "object") throw new ProviderBudgetError("provider_budget_unavailable")
    const decision = data as { grantedSymbolCount?: unknown; code?: unknown; retryAfterSeconds?: unknown }
    const granted = decision.grantedSymbolCount
    if (typeof granted === "number" && Number.isInteger(granted) && granted > 0 && granted <= requested && granted <= 50) return granted
    if (granted === 0 && (decision.code === "provider_refresh_rate_limited" || decision.code === "provider_capacity_unconfigured" || decision.code === "provider_refresh_paused")) {
      throw new ProviderBudgetError(decision.code,
        typeof decision.retryAfterSeconds === "number" && Number.isFinite(decision.retryAfterSeconds) && decision.retryAfterSeconds > 0
          ? Math.ceil(decision.retryAfterSeconds) : undefined)
    }
    throw new ProviderBudgetError("provider_budget_unavailable")
  } catch (error) {
    if (error instanceof ProviderBudgetError) throw error
    throw new ProviderBudgetError("provider_budget_unavailable")
  }
}
