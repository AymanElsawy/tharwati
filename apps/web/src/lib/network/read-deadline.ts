export const READ_DEADLINE_MS = {
  simple: 12_000,
  financial: 20_000,
  market: 20_000,
  dashboard: 30_000,
  composite: 45_000,
  export: 90_000,
} as const

export class ReadTimeoutError extends Error {
  readonly code = "ETIMEDOUT"
  cause?: unknown

  constructor(cause?: unknown) {
    super("The read request timed out")
    this.name = "TimeoutError"
    this.cause = cause
  }
}

export class ReadAbortedError extends Error {
  constructor() {
    super("The read request was canceled")
    this.name = "AbortError"
  }
}

/** A deadline for reads only. Late transport results are consumed, never returned. */
export function readWithDeadline<T>(
  durationMs: number,
  read: (signal: AbortSignal) => PromiseLike<T>,
  parentSignal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController()
  return new Promise<T>((resolve, reject) => {
    let settled = false
    let timeoutError: ReadTimeoutError | null = null
    const timer = setTimeout(() => {
      controller.abort()
      timeoutError = new ReadTimeoutError()
      finish({ error: timeoutError })
    }, durationMs)
    const finish = (result: { value: T } | { error: unknown }) => {
      if (settled) {
        if ("error" in result && timeoutError) timeoutError.cause = result.error
        return
      }
      settled = true
      clearTimeout(timer)
      parentSignal?.removeEventListener("abort", onParentAbort)
      if ("error" in result) reject(result.error)
      else resolve(result.value)
    }
    const onParentAbort = () => {
      controller.abort()
      finish({ error: new ReadAbortedError() })
    }
    if (parentSignal?.aborted) {
      onParentAbort()
      return
    }
    parentSignal?.addEventListener("abort", onParentAbort, { once: true })
    Promise.resolve()
      .then(() => read(controller.signal))
      .then((value) => finish({ value }), (error) => finish({ error }))
  })
}
