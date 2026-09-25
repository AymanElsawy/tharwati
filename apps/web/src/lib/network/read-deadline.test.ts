import { afterEach, describe, expect, it, vi } from "vitest"

import { classifyAppError } from "@/lib/errors/app-error"
import { AccountsRepository } from "@/features/accounts/repositories/accounts.repository"
import type { TypedSupabaseClient } from "@/lib/supabase/client"
import { MarketDataService } from "@/services/market-data/service"
import { ReadAbortedError, ReadTimeoutError, readWithDeadline } from "./read-deadline"

afterEach(() => vi.useRealTimers())

describe("readWithDeadline", () => {
  it("aborts the transport and classifies deadline expiry as timeout", async () => {
    vi.useFakeTimers()
    let signal: AbortSignal | undefined
    const request = readWithDeadline(20, (value) => {
      signal = value
      return new Promise<string>(() => {})
    })
    const rejection = expect(request).rejects.toBeInstanceOf(ReadTimeoutError)
    await vi.advanceTimersByTimeAsync(20)
    await rejection
    expect(signal?.aborted).toBe(true)
    expect(classifyAppError(new ReadTimeoutError()).code).toBe("timeout")
  })

  it("settles despite ignored abort and consumes late completion", async () => {
    vi.useFakeTimers()
    let complete!: (value: string) => void
    const request = readWithDeadline(20, () => new Promise<string>((resolve) => { complete = resolve }))
    const rejection = expect(request).rejects.toBeInstanceOf(ReadTimeoutError)
    await vi.advanceTimersByTimeAsync(20)
    await rejection
    complete("late")
    await Promise.resolve()
  })

  it("distinguishes a parent abort from a deadline", async () => {
    const parent = new AbortController()
    const request = readWithDeadline(20_000, () => new Promise<string>(() => {}), parent.signal)
    parent.abort()
    await expect(request).rejects.toBeInstanceOf(ReadAbortedError)
  })

  it("aborts a PostgREST account read at its deadline", async () => {
    vi.useFakeTimers()
    let signal: AbortSignal | undefined
    const pending = new Promise<never>(() => {})
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      abortSignal: (value: AbortSignal) => { signal = value; return pending },
    }
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) },
      from: () => query,
    } as unknown as TypedSupabaseClient
    const request = new AccountsRepository(client).getAccounts()
    const rejection = expect(request).rejects.toBeInstanceOf(ReadTimeoutError)
    await vi.advanceTimersByTimeAsync(12_000)
    await rejection
    expect(signal?.aborted).toBe(true)
  })

  it("aborts a market Edge read without producing an unavailable price", async () => {
    vi.useFakeTimers()
    let signal: AbortSignal | undefined
    const client = {
      functions: { invoke: vi.fn((_: string, options: { signal: AbortSignal }) => {
        signal = options.signal
        return new Promise<never>(() => {})
      }) },
    } as unknown as TypedSupabaseClient
    const request = new MarketDataService({ readClient: client }).getCurrentPrices(["asset-1"])
    const rejection = expect(request).rejects.toBeInstanceOf(ReadTimeoutError)
    await vi.advanceTimersByTimeAsync(20_000)
    await rejection
    expect(signal?.aborted).toBe(true)
  })
})
