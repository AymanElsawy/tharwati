export const dashboardValuationTimingStages = [
  "auth_get_user",
  "profile_read",
  "snapshot_lookup",
  "accounts_read",
  "balances_rpc",
  "effective_valuations_rpc",
  "current_ownership_rpc",
  "holdings_read",
  "metal_purchases_read",
  "market_prices_call",
  "metal_price_calls",
  "metal_price_request_sum",
  "fx_calls",
  "fx_request_sum",
  "snapshot_persistence",
] as const

export type DashboardValuationTimingStage = typeof dashboardValuationTimingStages[number]
export type DashboardValuationSnapshotMode = "hit" | "rebuild" | "error"
export type DashboardValuationTimingSummary = {
  snapshotMode: DashboardValuationSnapshotMode
  coldStartObserved: boolean
  totalMs: number
  stagesMs: Partial<Record<DashboardValuationTimingStage, number>>
  counts: {
    accounts: number
    fxPairs: number
    metalSymbols: number
  }
}

function roundedDuration(start: number): number {
  return Math.round((performance.now() - start) * 10) / 10
}

/** Collects opt-in, aggregate-only Edge timings without retaining request data. */
export class DashboardValuationPerformance {
  private readonly startedAt = performance.now()
  private readonly stagesMs: Partial<Record<DashboardValuationTimingStage, number>> = {}
  private readonly enabled: boolean
  private accounts = 0
  private fxPairs = 0
  private metalSymbols = 0

  constructor(enabled: boolean) {
    this.enabled = enabled
  }

  async measure<T>(stage: DashboardValuationTimingStage, operation: () => Promise<T>): Promise<T> {
    if (!this.enabled) return operation()
    const startedAt = performance.now()
    try {
      return await operation()
    } finally {
      this.stagesMs[stage] = (this.stagesMs[stage] ?? 0) + roundedDuration(startedAt)
    }
  }

  setAccountCount(count: number) {
    if (this.enabled) this.accounts = count
  }

  addFxPair() {
    if (this.enabled) this.fxPairs += 1
  }

  setMetalSymbolCount(count: number) {
    if (this.enabled) this.metalSymbols = count
  }

  summary(snapshotMode: DashboardValuationSnapshotMode, coldStartObserved: boolean): DashboardValuationTimingSummary | null {
    if (!this.enabled) return null
    return {
      snapshotMode,
      coldStartObserved,
      totalMs: roundedDuration(this.startedAt),
      stagesMs: this.stagesMs,
      counts: { accounts: this.accounts, fxPairs: this.fxPairs, metalSymbols: this.metalSymbols },
    }
  }
}
