import { afterEach, describe, expect, it, vi } from "vitest"

import dialog from "./AccountRecordFormDialog.tsx?raw"
import moneyInput from "@/components/MoneyInput.tsx?raw"
import { MutationViewOwner, RetainedMutations, isCommitted } from "@/lib/mutations/retained-mutation"
import { createTransferFxRequestGate, requestTransferFxPreview } from "../utils/transfer-fx-preview"

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

afterEach(() => vi.useRealTimers())

describe("AccountRecordFormDialog amount direction", () => {
  it("does not reset a newer form when a late save refreshes the account object", () => {
    expect(dialog).toContain("[initialAccountId, initialValues, open, reset]")
    expect(dialog).toContain("onPayloadChange?.()")
    expect(dialog).not.toContain("[initialAccount, initialValues, open, reset]")
  })

  it("reconciles an older timed-out save without changing a newer Transfer form or FX preview", async () => {
    vi.useFakeTimers()
    const attempts = new RetainedMutations()
    const view = new MutationViewOwner()
    const ownsOldForm = view.capture()
    const oldWrite = deferred()
    const oldRefresh = deferred()
    const attempt = attempts.prepare("account:record.create", "old payload", () => oldWrite.promise)
    let uncertainWarning = false
    let closed = false
    let form = { amount: "1000", receivedAmount: "3750", accountId: "old" }
    const applyOldOutcome = (outcome: Awaited<ReturnType<typeof attempts.run>>) => {
      uncertainWarning = attempts.hasUncertain
      if (ownsOldForm() && isCommitted(outcome)) {
        closed = true
        form = { amount: "1000", receivedAmount: "3750", accountId: "old" }
      }
    }
    const original = attempts.run(attempt, {
      deadlineMs: 100,
      refresh: () => oldRefresh.promise,
      onLateOutcome: applyOldOutcome,
    })
    await vi.advanceTimersByTimeAsync(100)
    applyOldOutcome(await original)
    expect(uncertainWarning).toBe(true)

    view.invalidate() // old dialog dismissed; newer Transfer owns the form
    form = { amount: "2000", receivedAmount: "", accountId: "new" }
    const newFxGate = createTransferFxRequestGate()
    requestTransferFxPreview({
      amount: form.amount,
      gate: newFxGate,
      estimate: async () => "7500",
      onReceived: (received) => { form.receivedAmount = received },
      onUnavailable: () => { form.receivedAmount = "" },
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(form).toEqual({ amount: "2000", receivedAmount: "7500", accountId: "new" })

    oldWrite.resolve()
    await vi.advanceTimersByTimeAsync(0)
    oldRefresh.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(attempt.outcome?.status).toBe("committed")
    expect(uncertainWarning).toBe(false)
    expect(closed).toBe(false)
    expect(form).toEqual({ amount: "2000", receivedAmount: "7500", accountId: "new" })
  })
  it("isolates amount value and currency suffix from RTL layout", () => {
    expect(dialog).toContain('<div className="relative" dir="ltr">')
    expect(dialog).toContain("className={`${field} pe-16`}")
    expect(dialog).toContain("<MoneyInput")
    expect(moneyInput).toContain('inputMode="decimal"')
    expect(dialog).toContain(
      "pointer-events-none absolute inset-y-0 end-3 flex items-center"
    )
  })

  it("renders distinct localized account labels while submitting account UUIDs", () => {
    expect(dialog).toContain("getAccountPickerOptions(accounts, t)")
    expect(dialog).toContain("key={option.value} value={option.value}")
  })

  it("clears derived FX on sent-amount edits and blocks invalid Transfer submission", () => {
    expect(dialog).toContain("onAmountChange={invalidateFxPreview}")
    expect(dialog).toContain('setValue("receivedAmount", "")')
    expect(dialog).toContain('clearErrors("receivedAmount")')
    expect(dialog).toContain('(recordType === "transfer" && !validSentAmount)')
    expect(dialog).toContain("requestTransferFxPreview({")
  })

  it("suppresses an empty amount error until blur or another submit", () => {
    expect(dialog).toContain("visibleMoneyInputError(")
    expect(dialog).toContain('setSuppressedAtSubmitCount(value === "" ? submitCount : null)')
    expect(dialog).toContain("submitCount <= suppressedAtSubmitCount")
    expect(dialog).toContain("void trigger(name)")
  })

  it("does not render a dependent received-amount error for an invalid sent amount", () => {
    expect(dialog).toContain("validSentAmount ? errors.receivedAmount?.message : undefined")
    expect(dialog).toContain("disabled={!validSentAmount}")
  })
})
