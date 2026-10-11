import { bounded } from "./market-reliability.ts"
import { ProviderBudgetError } from "./provider-budget.ts"

type ReservationClient = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> }

/** One atomic charge per outbound request; returns only the affordable prefix. */
export async function reserveTwelveDataSymbols(client: ReservationClient, requested: number): Promise<number> {
  const startedAt = Date.now()
  let failure: "rpc" | "invalid_response" = "rpc"
  try {
    const result = await bounded(2000, () => client.rpc("reserve_twelve_data_symbols", { p_requested_symbols: requested }))
    if (result?.error) throw new Error("reservation RPC failed")
    failure = "invalid_response"
    const data = result?.data
    if (!data || typeof data !== "object") throw new Error("invalid reservation response")
    const decision = data as { grantedSymbolCount?: unknown; code?: unknown; retryAfterSeconds?: unknown }
    const granted = decision.grantedSymbolCount
    if (typeof granted === "number" && Number.isInteger(granted) && granted > 0 && granted <= requested && granted <= 50) return granted
    if (granted === 0 && (decision.code === "provider_refresh_rate_limited" || decision.code === "provider_capacity_unconfigured" || decision.code === "provider_refresh_paused")) {
      throw new ProviderBudgetError(decision.code,
        typeof decision.retryAfterSeconds === "number" && Number.isFinite(decision.retryAfterSeconds) && decision.retryAfterSeconds > 0
          ? Math.ceil(decision.retryAfterSeconds) : undefined)
    }
    throw new Error("invalid reservation response")
  } catch (error) {
    if (error instanceof ProviderBudgetError) throw error
    const elapsedMs = Math.max(0, Date.now() - startedAt)
    console.warn("Twelve Data reservation failed", {
      failure: error instanceof DOMException && error.name === "AbortError" && elapsedMs >= 2000
        ? "timeout" : failure,
      elapsedMs,
    })
    throw new ProviderBudgetError("provider_budget_unavailable")
  }
}
