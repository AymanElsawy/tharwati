import { afterEach, describe, expect, it, vi } from "vitest"
import {
  RetainedMutations,
  MutationViewOwner,
  LEDGER_WRITE_DEADLINE_MS,
  isDefinitiveRejection,
} from "./retained-mutation"
import { AccountRecordsRepository } from "@/features/accounts/repositories/account-records.repository"
import type { TypedSupabaseClient } from "@/lib/supabase/client"
import type { AccountRecordFormValues } from "@/features/accounts/types/account-record"
import { accountRecordSubmissionFingerprint } from "@/features/accounts/utils/account-record-submission"

function pending() {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
const refresh = async () => {}
afterEach(() => vi.useRealTimers())

describe("retained mutation outcomes", () => {
  it.each(["P0001", "P0002", "23514", "22P02", "42501"])(
    "recognizes server rejection %s without interpreting text",
    async (code) => {
      const owner = new RetainedMutations()
      const error = { cause: { code, message: "private RPC details" } }
      const attempt = owner.prepare("record", "payload", async () => {
        throw error
      })
      const read = vi.fn(refresh)
      expect(await owner.run(attempt, { refresh: read })).toEqual({
        status: "rejected",
        error,
      })
      expect(read).not.toHaveBeenCalled()
    }
  )

  it.each([
    new TypeError("Failed to fetch"),
    { code: "503" },
    { code: "PGRST000" },
    new Error("lost"),
  ])("transport ambiguity is uncertain", async (error) => {
    const owner = new RetainedMutations()
    const write = vi.fn(async () => {
      throw error
    })
    const attempt = owner.prepare("record", "payload", write)
    expect(await owner.run(attempt, { refresh })).toEqual({
      status: "uncertain",
    })
    expect(write).toHaveBeenCalledTimes(1)
    expect(isDefinitiveRejection(error)).toBe(false)
  })

  it("bounds only dispatch at 45 seconds and does not automatically retry", async () => {
    vi.useFakeTimers()
    const owner = new RetainedMutations()
    const response = pending()
    const write = vi.fn(() => response.promise)
    const attempt = owner.prepare("record", "payload", write)
    const late = vi.fn()
    const run = owner.run(attempt, { refresh, onLateOutcome: late })
    await vi.advanceTimersByTimeAsync(LEDGER_WRITE_DEADLINE_MS)
    expect(await run).toEqual({ status: "uncertain" })
    await vi.advanceTimersByTimeAsync(90_000)
    expect(write).toHaveBeenCalledTimes(1)
    response.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(attempt.outcome).toEqual({ status: "committed" })
    expect(late).toHaveBeenCalledWith({ status: "committed" })
  })

  it("does not include refresh in the write deadline", async () => {
    vi.useFakeTimers()
    const owner = new RetainedMutations()
    const read = pending()
    const attempt = owner.prepare("record", "payload", async () => {})
    const run = owner.run(attempt, { refresh: () => read.promise })
    await vi.advanceTimersByTimeAsync(90_000)
    expect(attempt.outcome?.status).toBe("committed")
    read.reject(new Error("refresh timeout"))
    expect(await run).toEqual({ status: "committed_refresh_failed" })
  })

  it("late definitive rejection resolves a timed-out delivery, but not an earlier lost response", async () => {
    vi.useFakeTimers()
    const owner = new RetainedMutations()
    const response = pending()
    const attempt = owner.prepare("record", "payload", () => response.promise)
    const run = owner.run(attempt, { refresh })
    await vi.advanceTimersByTimeAsync(45_000)
    expect((await run).status).toBe("uncertain")
    response.reject({ code: "P0002" })
    await vi.advanceTimersByTimeAsync(0)
    expect(attempt.outcome?.status).toBe("rejected")

    let calls = 0
    const lost = owner.prepare("record", "lost", async () => {
      if (++calls === 1) throw new TypeError("response lost")
      throw { code: "P0002" }
    })
    await owner.run(lost, { refresh })
    expect((await owner.run(lost, { refresh })).status).toBe("uncertain")
  })

  it("preserves unresolved attempts and scopes keys; changed payload gets a new key", async () => {
    const owner = new RetainedMutations()
    const lost = async () => {
      throw new Error("lost response")
    }
    const first = owner.prepare("account:record", "1000", lost)
    await owner.run(first, { refresh })
    const changed = owner.prepare("account:record", "2000", lost)
    expect(changed.idempotencyKey).not.toBe(first.idempotencyKey)
    expect(owner.prepare("account:record", "1000", lost)).toBe(first)
    expect(owner.prepare("other:record", "1000", lost).idempotencyKey).not.toBe(
      first.idempotencyKey
    )
    expect(owner.hasUncertain).toBe(true)
  })

  it("late success resolves its attempt but cannot close or change a newer form", async () => {
    vi.useFakeTimers()
    const owner = new RetainedMutations()
    const view = new MutationViewOwner()
    const isOriginalForm = view.capture()
    const response = pending()
    const old = owner.prepare("record", "old", () => response.promise)
    const close = vi.fn()
    const changeError = vi.fn()
    const run = owner.run(old, {
      refresh,
      onLateOutcome: (outcome) => {
        if (isOriginalForm()) {
          close()
          changeError(outcome)
        }
      },
    })
    await vi.advanceTimersByTimeAsync(45_000)
    await run
    view.invalidate() // edit, dismiss, or replace the form
    const next = owner.prepare("record", "new", async () => {
      throw new Error("offline")
    })
    await owner.run(next, { refresh })
    response.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(old.outcome?.status).toBe("committed")
    expect(next.outcome?.status).toBe("uncertain")
    expect(close).not.toHaveBeenCalled()
    expect(changeError).not.toHaveBeenCalled()
  })

  it("a stale rejection cannot downgrade a replay-confirmed commit", async () => {
    vi.useFakeTimers()
    const owner = new RetainedMutations()
    const old = pending()
    let calls = 0
    const attempt = owner.prepare("record", "payload", () =>
      ++calls === 1 ? old.promise : Promise.resolve()
    )
    const first = owner.run(attempt, { refresh })
    await vi.advanceTimersByTimeAsync(45_000)
    await first
    expect((await owner.run(attempt, { refresh })).status).toBe("committed")
    old.reject({ code: "23514" })
    await vi.advanceTimersByTimeAsync(0)
    expect(attempt.outcome?.status).toBe("committed")
    expect(calls).toBe(2)
  })

  it("committed refresh failure retries reads only", async () => {
    const owner = new RetainedMutations()
    const write = vi.fn(refresh)
    const read = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(undefined)
    const attempt = owner.prepare("record", "payload", write)
    expect((await owner.run(attempt, { refresh: read })).status).toBe(
      "committed_refresh_failed"
    )
    expect((await owner.run(attempt, { refresh: read })).status).toBe(
      "committed"
    )
    expect(write).toHaveBeenCalledTimes(1)
    expect(read).toHaveBeenCalledTimes(2)
  })
})

describe("ledger/refund repository replay integration", () => {
  it.each([
    "income",
    "expense",
    "transfer",
    "refund.create",
    "refund.cancel",
  ] as const)(
    "%s lost response + explicit same-key replay has one effect",
    async (operation) => {
      const effects = new Set<string>()
      const keys: string[] = []
      const rpc = vi.fn(
        async (name: string, payload: Record<string, unknown>) => {
          const key = String(payload.p_idempotency_key)
          keys.push(key)
          const identity = `${name}:${key}`
          if (!effects.has(identity)) {
            effects.add(identity) // simulated atomic server commit, response lost
            throw new TypeError("response lost")
          }
          return { data: { replayed: true }, error: null }
        }
      )
      const repository = new AccountRecordsRepository({
        rpc,
      } as unknown as TypedSupabaseClient)
      const values: AccountRecordFormValues = {
        type:
          operation === "transfer"
            ? "transfer"
            : operation === "income"
              ? "income"
              : "expense",
        accountId: "source",
        toAccountId: "destination",
        amount: "9007199254740993.01",
        receivedAmount: "9007199254740993.01",
        occurredAt: "2026-09-26T10:00",
        mainCategoryId: "main",
        subcategoryId: "sub",
        notes: "",
      }
      const dispatch = (key: string) =>
        operation === "refund.cancel"
          ? repository.cancelExpenseRefund("refund", key)
          : operation === "refund.create"
            ? repository.addExpenseRefund({
                expenseTransactionId: "expense",
                destinationAccountId: "source",
                amount: values.amount,
                occurredAt: values.occurredAt,
                notes: "",
                idempotencyKey: key,
              })
            : repository.addAccountRecord(values, key)
      const owner = new RetainedMutations()
      const fingerprint = accountRecordSubmissionFingerprint(values)
      const attempt = owner.prepare(operation, fingerprint, dispatch)
      expect((await owner.run(attempt, { refresh })).status).toBe("uncertain")
      const retry = owner.prepare(operation, fingerprint, dispatch)
      expect((await owner.run(retry, { refresh })).status).toBe("committed")
      expect(keys).toEqual([attempt.idempotencyKey, attempt.idempotencyKey])
      expect(effects.size).toBe(1)
      if (operation !== "refund.cancel")
        expect(rpc.mock.calls[0][1].p_amount).toBe(values.amount)
    }
  )
})
