import { afterEach, describe, expect, it, vi } from "vitest"

import { ReadTimeoutError } from "@/lib/network/read-deadline"

const mock = vi.hoisted(() => {
  const signals: AbortSignal[] = []
  const query: Record<string, unknown> = {}
  for (const method of ["select", "eq", "is", "order", "limit", "in", "maybeSingle", "single"]) {
    query[method] = () => query
  }
  query.abortSignal = (signal: AbortSignal) => { signals.push(signal); return query }
  query.then = () => undefined
  const from = vi.fn(() => query)
  const rpc = vi.fn()
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null })
  return { signals, from, rpc, getUser }
})

vi.mock("@/lib/supabase", () => ({ supabase: { from: mock.from, rpc: mock.rpc, auth: { getUser: mock.getUser } } }))

import { goalsRepository } from "@/features/goals/repositories/goals.repository"
import { getCurrentUserProfile } from "@/features/profile/repositories/profile.repository"
import { wealthAllocationTargetsRepository } from "./wealth-allocation-targets.repository"

afterEach(() => {
  vi.useRealTimers()
  mock.signals.length = 0
  mock.from.mockClear()
  mock.rpc.mockClear()
})

describe("remaining simple financial reads", () => {
  it.each([
    ["Goals", () => goalsRepository.list()],
    ["Dashboard goal summaries", () => goalsRepository.listActiveSummaries(3)],
    ["Analysis target plan", () => wealthAllocationTargetsRepository.load()],
    ["profile", () => getCurrentUserProfile("user-1")],
  ])("bounds %s at 12 seconds without invoking mutations", async (_, read) => {
    vi.useFakeTimers()
    const failure = expect(read()).rejects.toBeInstanceOf(ReadTimeoutError)
    await vi.advanceTimersByTimeAsync(12_000)
    await failure
    expect(mock.signals.length).toBeGreaterThan(0)
    expect(mock.signals.every((signal) => signal.aborted)).toBe(true)
    expect(mock.rpc).not.toHaveBeenCalled()
  })
})
