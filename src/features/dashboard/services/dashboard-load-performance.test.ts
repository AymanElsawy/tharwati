import { afterEach, describe, expect, it, vi } from "vitest"

import { createDashboardLoadPerformance } from "./dashboard-load-performance"

describe("Dashboard load performance instrumentation", () => {
  afterEach(() => vi.restoreAllMocks())

  it("records only stage names and no application payload", async () => {
    const mark = vi.spyOn(performance, "mark")
    const measure = vi.spyOn(performance, "measure")
    const trace = createDashboardLoadPerformance()

    await trace.measurePromise("profile-load", Promise.resolve())
    await trace.measure("snapshot-parsing-aggregation", () => undefined)
    trace.finish()

    expect(mark.mock.calls.flat()).toEqual(expect.arrayContaining([
      expect.stringContaining("load-start"),
      expect.stringContaining("profile-load:start"),
      expect.stringContaining("ready"),
    ]))
    expect(measure.mock.calls.flat()).toEqual(expect.arrayContaining([
      expect.stringContaining("profile-load"),
      expect.stringContaining("total-ready"),
    ]))
  })
})
