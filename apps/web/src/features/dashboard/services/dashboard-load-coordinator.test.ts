import { describe, expect, it } from "vitest"

import { DashboardLoadCoordinator } from "./dashboard-load-coordinator"

function deferred() {
  let resolve: () => void = () => undefined
  const promise = new Promise<void>((nextResolve) => { resolve = nextResolve })
  return { promise, resolve }
}

describe("DashboardLoadCoordinator", () => {
  it("runs the initial load once", async () => {
    const calls: boolean[] = []
    const coordinator = new DashboardLoadCoordinator(async (showLoading) => { calls.push(showLoading) })

    await coordinator.requestInitial()
    await coordinator.requestInitial()

    expect(calls).toEqual([true])
  })

  it("runs a legitimate data-change refresh after the initial load", async () => {
    const calls: boolean[] = []
    const coordinator = new DashboardLoadCoordinator(async (showLoading) => { calls.push(showLoading) })

    await coordinator.requestInitial()
    await coordinator.request(false)

    expect(calls).toEqual([true, false])
  })

  it("suppresses overlapping loads and queues exactly one refresh", async () => {
    const first = deferred()
    const second = deferred()
    const calls: boolean[] = []
    const coordinator = new DashboardLoadCoordinator(async (showLoading) => {
      calls.push(showLoading)
      await (calls.length === 1 ? first.promise : second.promise)
    })

    const initial = coordinator.request(true)
    coordinator.request(false)
    coordinator.request(false)
    expect(calls).toEqual([true])

    first.resolve()
    await initial
    await Promise.resolve()
    expect(calls).toEqual([true, false])

    second.resolve()
  })

  it("keeps a requested visible refresh when it is queued", async () => {
    const first = deferred()
    const second = deferred()
    const calls: boolean[] = []
    const coordinator = new DashboardLoadCoordinator(async (showLoading) => {
      calls.push(showLoading)
      await (calls.length === 1 ? first.promise : second.promise)
    })

    const initial = coordinator.request(false)
    coordinator.request(true)
    first.resolve()
    await initial
    await Promise.resolve()

    expect(calls).toEqual([false, true])
    second.resolve()
  })

  it("runs a queued refresh after an error", async () => {
    const calls: boolean[] = []
    let attempt = 0
    const coordinator = new DashboardLoadCoordinator(async (showLoading) => {
      calls.push(showLoading)
      attempt += 1
      if (attempt === 1) throw new Error("initial failure")
    })

    const initial = coordinator.request(true)
    coordinator.request(false)

    await expect(initial).rejects.toThrow("initial failure")
    await Promise.resolve()
    await Promise.resolve()
    expect(calls).toEqual([true, false])
  })
})
