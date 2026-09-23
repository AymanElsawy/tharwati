import { describe, expect, it, vi } from "vitest"

import { runMutationThenRefresh } from "./mutation-refresh"

describe("runMutationThenRefresh", () => {
  it("commits before refresh and reports a stale refresh separately", async () => {
    const order: string[] = []
    const outcome = await runMutationThenRefresh({
      mutate: async () => void order.push("mutation"),
      onCommitted: () => void order.push("closed"),
      refresh: async () => {
        order.push("refresh")
        throw new Error("offline")
      },
    })

    expect(outcome).toEqual({ mutation: "committed", refresh: "stale" })
    expect(order).toEqual(["mutation", "closed", "refresh"])
  })

  it("does not close or refresh after mutation rejection", async () => {
    const onCommitted = vi.fn()
    const refresh = vi.fn()
    const outcome = await runMutationThenRefresh({
      mutate: async () => {
        throw new Error("rejected")
      },
      onCommitted,
      refresh,
    })

    expect(outcome.mutation).toBe("rejected")
    expect(onCommitted).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })
})
