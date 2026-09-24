import { describe, expect, it, vi } from "vitest"

import page from "./BrokerageAccountDetailsPage.tsx?raw"
import { runMutationThenRefresh } from "@/lib/mutations/mutation-refresh"

describe("Add Existing Holding market value refresh", () => {
  it("dispatches the account data-change event from its committed callback", async () => {
    const saveStart = page.indexOf("const save = async () =>", page.indexOf("function ExistingHoldingDialog"))
    const saveEnd = page.indexOf("const handleAssetCreated", saveStart)
    const save = page.slice(saveStart, saveEnd)

    expect(save).toContain(
      'onCommitted: () => { attempt.current = null; onClose(); window.dispatchEvent(new Event("tharwati:data-changed")) }',
    )

    const dispatch = vi.fn()
    const outcome = await runMutationThenRefresh({
      mutate: vi.fn().mockResolvedValue(undefined),
      onCommitted: () => dispatch(new Event("tharwati:data-changed")),
      refresh: vi.fn().mockResolvedValue(undefined),
    })

    expect(outcome.mutation).toBe("committed")
    expect(dispatch).toHaveBeenCalledOnce()
    expect(dispatch.mock.calls[0]?.[0].type).toBe("tharwati:data-changed")
  })

  it("does not dispatch the event when the create mutation fails", async () => {
    const dispatch = vi.fn()
    const outcome = await runMutationThenRefresh({
      mutate: vi.fn().mockRejectedValue(new Error("mutation failed")),
      onCommitted: () => dispatch(new Event("tharwati:data-changed")),
      refresh: vi.fn(),
    })

    expect(outcome.mutation).toBe("rejected")
    expect(dispatch).not.toHaveBeenCalled()
  })
})
