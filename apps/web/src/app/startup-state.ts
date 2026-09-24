export type StartupStage =
  | "reading-session"
  | "reading-account"
  | "ready"
  | "failed-session"
  | "failed-account"

const STARTUP_TIMEOUT_MS = 15_000

export function withStartupTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error("startup timeout")),
      STARTUP_TIMEOUT_MS,
    )
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        window.clearTimeout(timer)
        reject(error)
      },
    )
  })
}
