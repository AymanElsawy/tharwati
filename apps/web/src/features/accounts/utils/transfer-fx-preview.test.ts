import { describe, expect, it, vi } from "vitest"
import { normalizeMoneyInput } from "@/lib/formatting/money-input"
import type { Translate } from "@/i18n/context"
import { createAccountRecordSchema } from "../schemas/account-record.schema"
import { emptyAccountRecordFormValues } from "../types/account-record"
import {
  createTransferFxRequestGate,
  invalidateTransferFxPreview,
  isValidTransferSentAmount,
  requestTransferFxPreview,
} from "./transfer-fx-preview"

function deferred() {
  let resolve!: (value: string) => void
  const promise = new Promise<string>((complete) => { resolve = complete })
  return { promise, resolve }
}

describe("Transfer FX preview state", () => {
  it("clears a valid preview for invalid grouping and restores it after correction", async () => {
    const gate = createTransferFxRequestGate()
    const estimate = vi.fn().mockResolvedValueOnce("4000")
      .mockResolvedValueOnce("4000")
    let received = ""
    let unavailable = false
    const change = (text: string) => {
      const amount = normalizeMoneyInput(text) ?? text
      invalidateTransferFxPreview(gate, () => { received = "" })
      unavailable = false
      requestTransferFxPreview({
        amount, gate, estimate,
        onReceived: (value) => { received = value },
        onUnavailable: () => { unavailable = true },
      })
      return amount
    }

    expect(change("1,000")).toBe("1000")
    await vi.waitFor(() => expect(received).toBe("4000"))
    expect(estimate).toHaveBeenCalledTimes(1)
    expect(estimate).toHaveBeenCalledWith("1000")

    const invalid = change("1,00")
    expect(received).toBe("")
    expect(unavailable).toBe(false)
    expect(estimate).toHaveBeenCalledTimes(1)
    expect(isValidTransferSentAmount(invalid)).toBe(false)
    expect(createAccountRecordSchema(((key: string) => key) as Translate).safeParse({
      ...emptyAccountRecordFormValues,
      type: "transfer", accountId: "source", toAccountId: "destination",
      amount: invalid, receivedAmount: "4000", occurredAt: "2026-09-26T12:00",
    }).success).toBe(false)

    expect(change("1,000")).toBe("1000")
    await vi.waitFor(() => expect(received).toBe("4000"))
    expect(estimate).toHaveBeenCalledTimes(2)
  })

  it("ignores a stale async result after the amount changes", async () => {
    const gate = createTransferFxRequestGate()
    const old = deferred()
    const current = deferred()
    const estimate = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise)
    let received = ""
    const preview = (amount: string) => requestTransferFxPreview({
      amount, gate, estimate,
      onReceived: (value) => { received = value },
      onUnavailable: () => undefined,
    })
    preview("1000")
    invalidateTransferFxPreview(gate, () => { received = "" })
    preview("2000")
    old.resolve("4000")
    await Promise.resolve()
    expect(received).toBe("")
    current.resolve("8000")
    await Promise.resolve()
    expect(received).toBe("8000")
  })

  it("keeps unavailable FX distinct from an invalid amount", async () => {
    const gate = createTransferFxRequestGate()
    const estimate = vi.fn().mockRejectedValue(new Error("unavailable"))
    let unavailable = false
    requestTransferFxPreview({ amount: "1,00", gate, estimate,
      onReceived: () => undefined, onUnavailable: () => { unavailable = true } })
    expect(estimate).not.toHaveBeenCalled()
    expect(unavailable).toBe(false)
    requestTransferFxPreview({ amount: "", gate, estimate,
      onReceived: () => undefined, onUnavailable: () => { unavailable = true } })
    expect(estimate).not.toHaveBeenCalled()
    expect(unavailable).toBe(false)
    requestTransferFxPreview({ amount: "1000", gate, estimate,
      onReceived: () => undefined, onUnavailable: () => { unavailable = true } })
    await vi.waitFor(() => expect(unavailable).toBe(true))
  })
})
