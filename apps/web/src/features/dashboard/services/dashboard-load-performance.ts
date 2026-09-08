const prefix = "tharwati:dashboard"
let sequence = 0

export type DashboardLoadPerformance = {
  measurePromise<T>(stage: string, task: Promise<T>): Promise<T>
  measure<T>(stage: string, task: () => T | Promise<T>): Promise<T>
  finish(): void
}

function isEnabled() {
  return import.meta.env.DEV && typeof performance !== "undefined"
}

export function createDashboardLoadPerformance(): DashboardLoadPerformance {
  const id = ++sequence
  const name = (stage: string) => `${prefix}:${id}:${stage}`
  const mark = (stage: string) => {
    if (isEnabled()) performance.mark(name(stage))
  }
  const measure = (stage: string, start: string, end: string) => {
    if (isEnabled()) performance.measure(name(stage), name(start), name(end))
  }

  mark("load-start")
  return {
    async measurePromise<T>(stage: string, task: Promise<T>) {
      mark(`${stage}:start`)
      try {
        return await task
      } finally {
        mark(`${stage}:end`)
        measure(stage, `${stage}:start`, `${stage}:end`)
      }
    },
    async measure<T>(stage: string, task: () => T | Promise<T>) {
      mark(`${stage}:start`)
      try {
        return await task()
      } finally {
        mark(`${stage}:end`)
        measure(stage, `${stage}:start`, `${stage}:end`)
      }
    },
    finish() {
      mark("ready")
      measure("total-ready", "load-start", "ready")
    },
  }
}
