import { bounded } from "./market-reliability.ts"

type BudgetClient = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> }
export type ProviderOperation = "market" | "search" | "fx" | "metal"
export type RefreshCode = "provider_refresh_rate_limited" | "provider_budget_unavailable" | "provider_capacity_unconfigured" | "provider_refresh_paused"

export class ProviderBudgetError extends Error {
  constructor(readonly code: RefreshCode, readonly retryAfterSeconds?: number) {
    super(code)
    this.name = "ProviderBudgetError"
  }
}

/** Caller JWT client only: the SQL function derives identity from auth.uid(). */
export async function reserveProviderCall(client: BudgetClient, operation: ProviderOperation, units = 1): Promise<void> {
  try {
    const { data, error } = await bounded(750, () => client.rpc("reserve_provider_budget", {
      p_provider: operation === "fx" ? "frankfurter" : operation === "metal" ? "gold_api" : "twelve_data",
      p_operation: operation, p_units: units,
    }))
    if (error || !data || typeof data !== "object") throw new ProviderBudgetError("provider_budget_unavailable")
    const decision = data as { allowed?: unknown; code?: unknown; retryAfterSeconds?: unknown }
    if (decision.allowed === true) return
    if (decision.allowed === false && (decision.code === "provider_capacity_unconfigured" || decision.code === "provider_refresh_paused")) {
      throw new ProviderBudgetError(decision.code)
    }
    if (decision.allowed === false && decision.code === "provider_refresh_rate_limited") {
      throw new ProviderBudgetError("provider_refresh_rate_limited",
        typeof decision.retryAfterSeconds === "number" ? decision.retryAfterSeconds : undefined)
    }
    throw new ProviderBudgetError("provider_budget_unavailable")
  } catch (error) {
    if (error instanceof ProviderBudgetError) throw error
    // Fail closed for provider work, leaving persisted fallback reachable.
    throw new ProviderBudgetError("provider_budget_unavailable")
  }
}
