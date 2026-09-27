/** Opt-in write handling. Read deadlines must never wrap a mutation. */
export const LEDGER_WRITE_DEADLINE_MS = 45_000

export type MutationOutcome =
  | { status: "rejected"; error: unknown }
  | { status: "uncertain" }
  | { status: "committed" }
  | { status: "committed_refresh_failed" }

export function isCommitted(outcome: MutationOutcome | undefined): boolean {
  return (
    outcome?.status === "committed" ||
    outcome?.status === "committed_refresh_failed"
  )
}

/** Only protocol evidence of rejection is trusted, never backend message text. */
export function isDefinitiveRejection(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const value = error as { code?: unknown; cause?: unknown }
  if (value.cause && value.cause !== error)
    return isDefinitiveRejection(value.cause)
  return (
    typeof value.code === "string" &&
    /^(P000[12]|22[0-9A-Z]{3}|23[0-9A-Z]{3}|42501|PGRST100|PGRST301|authentication_required)$/.test(
      value.code
    )
  )
}

export class MutationAttempt {
  outcome?: MutationOutcome
  refreshing?: Promise<MutationOutcome>
  pendingWrites = 0
  ambiguousTransport = false
  readonly id: string
  readonly scope: string
  readonly fingerprint: string
  readonly idempotencyKey: string
  readonly dispatch: (key: string) => Promise<void>
  constructor(
    id: string,
    scope: string,
    fingerprint: string,
    idempotencyKey: string,
    dispatch: (key: string) => Promise<void>
  ) {
    this.id = id
    this.scope = scope
    this.fingerprint = fingerprint
    this.idempotencyKey = idempotencyKey
    this.dispatch = dispatch
  }
}

/** Form edits/dismissal revoke UI ownership, without discarding the write. */
export class MutationViewOwner {
  private version = 0
  invalidate(): void {
    this.version += 1
  }
  capture(): () => boolean {
    const version = this.version
    return () => version === this.version
  }
}

/** In-memory ownership only. Different payloads never evict unresolved attempts. */
export class RetainedMutations {
  private readonly attempts = new Map<string, MutationAttempt>()

  get hasUncertain(): boolean {
    return [...this.attempts.values()].some(
      (attempt) => attempt.outcome?.status === "uncertain"
    )
  }

  prepare(
    scope: string,
    fingerprint: string,
    dispatch: (key: string) => Promise<void>
  ): MutationAttempt {
    const identity = JSON.stringify([scope, fingerprint])
    const retained = this.attempts.get(identity)
    if (retained) return retained
    const attempt = new MutationAttempt(
      crypto.randomUUID(),
      scope,
      fingerprint,
      crypto.randomUUID(),
      dispatch
    )
    this.attempts.set(identity, attempt)
    return attempt
  }

  acknowledge(attempt: MutationAttempt): void {
    const identity = JSON.stringify([attempt.scope, attempt.fingerprint])
    if (isCommitted(attempt.outcome) && this.attempts.get(identity) === attempt)
      this.attempts.delete(identity)
  }

  private async refresh(
    attempt: MutationAttempt,
    read: () => Promise<void>
  ): Promise<MutationOutcome> {
    if (attempt.refreshing) return attempt.refreshing
    attempt.refreshing = (async () => {
      try {
        await read()
        attempt.outcome = { status: "committed" }
      } catch {
        attempt.outcome = { status: "committed_refresh_failed" }
      }
      return attempt.outcome
    })()
    try {
      return await attempt.refreshing
    } finally {
      attempt.refreshing = undefined
    }
  }

  /** One invocation = one explicit write, or reads only after known commitment. */
  run(
    attempt: MutationAttempt,
    options: {
      refresh: () => Promise<void>
      onLateOutcome?: (outcome: MutationOutcome) => void
      deadlineMs?: number
    }
  ): Promise<MutationOutcome> {
    if (isCommitted(attempt.outcome))
      return this.refresh(attempt, options.refresh)
    attempt.pendingWrites += 1
    return new Promise((resolve) => {
      let returned = false
      const finish = (outcome: MutationOutcome) => {
        if (returned) options.onLateOutcome?.(outcome)
        else {
          returned = true
          resolve(outcome)
        }
      }
      const timer = setTimeout(() => {
        if (!isCommitted(attempt.outcome))
          attempt.outcome = { status: "uncertain" }
        finish(attempt.outcome!)
      }, options.deadlineMs ?? LEDGER_WRITE_DEADLINE_MS)
      // Timer starts immediately before dispatch, not before validation or refresh.
      Promise.resolve()
        .then(() => attempt.dispatch(attempt.idempotencyKey))
        .then(
          async () => {
            clearTimeout(timer)
            attempt.pendingWrites -= 1
            attempt.outcome = { status: "committed" }
            finish(await this.refresh(attempt, options.refresh))
          },
          (error: unknown) => {
            clearTimeout(timer)
            attempt.pendingWrites -= 1
            if (!isDefinitiveRejection(error)) attempt.ambiguousTransport = true
            // An error from another delivery must never undo a confirmed commit.
            if (!isCommitted(attempt.outcome)) {
              attempt.outcome =
                attempt.ambiguousTransport || attempt.pendingWrites > 0
                  ? { status: "uncertain" }
                  : { status: "rejected", error }
            }
            finish(attempt.outcome!)
          }
        )
    })
  }
}
