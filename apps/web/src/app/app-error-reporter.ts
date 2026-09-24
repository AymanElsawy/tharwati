export type AppErrorCategory =
  | "bootstrap"
  | "render"
  | "window-error"
  | "unhandled-rejection"

export type AppErrorEvent = {
  category: AppErrorCategory
  error: unknown
}

export interface AppErrorReporter {
  capture(event: AppErrorEvent): void
}

export const noopAppErrorReporter: AppErrorReporter = {
  capture: () => undefined,
}

export function installGlobalErrorCapture(
  reporter: AppErrorReporter = noopAppErrorReporter,
): () => void {
  const onError = (event: ErrorEvent) => {
    reporter.capture({ category: "window-error", error: event.error })
  }
  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    reporter.capture({
      category: "unhandled-rejection",
      error: event.reason,
    })
  }

  window.addEventListener("error", onError)
  window.addEventListener("unhandledrejection", onUnhandledRejection)

  return () => {
    window.removeEventListener("error", onError)
    window.removeEventListener("unhandledrejection", onUnhandledRejection)
  }
}
