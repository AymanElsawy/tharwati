export type DashboardLoadExecutor = (showLoading: boolean) => Promise<void>

/** Serializes Dashboard refreshes while preserving one refresh requested mid-load. */
export class DashboardLoadCoordinator {
  private inFlight: Promise<void> | null = null
  private queued = false
  private queuedShowLoading = false
  private initialLoadRequested = false
  private readonly execute: DashboardLoadExecutor

  constructor(execute: DashboardLoadExecutor) {
    this.execute = execute
  }

  /** Runs once per mounted Dashboard instance, including React StrictMode effect replay. */
  requestInitial(): Promise<void> {
    if (this.initialLoadRequested) return Promise.resolve()
    this.initialLoadRequested = true
    return this.request(true)
  }

  request(showLoading: boolean): Promise<void> {
    if (this.inFlight) {
      this.queued = true
      this.queuedShowLoading = this.queuedShowLoading || showLoading
      return this.inFlight
    }

    const current = this.run(showLoading)
    this.inFlight = current
    return current
  }

  private async run(showLoading: boolean): Promise<void> {
    try {
      await this.execute(showLoading)
    } finally {
      this.inFlight = null
      if (this.queued) {
        const nextShowLoading = this.queuedShowLoading
        this.queued = false
        this.queuedShowLoading = false
        // The queued refresh is internal; callers are attached to the load that was
        // active when they requested it. Dashboard execution records its own errors.
        void this.request(nextShowLoading).catch(() => undefined)
      }
    }
  }
}
