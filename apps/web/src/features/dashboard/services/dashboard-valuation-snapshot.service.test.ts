import { describe, expect, it } from "vitest"

import {
  parseDashboardValuationSnapshot,
  snapshotRateResolver,
} from "./dashboard-valuation-snapshot.service"

const payload = {
  asOf: "2026-08-27T12:00:00.000Z",
  expiresAt: "2026-08-27T12:15:00.000Z",
  freshness: "fresh",
  currentValues: { cash: "1.0000000002", metal: "5.5" },
  accountBalances: { cash: "1.0000000002" },
  rates: { "EUR/USD": "1.2345678901" },
  unavailableSources: [],
  portfolioAllocation: {
    status: "complete",
    holdings: [{ assetId: "asset-1", assetTypeCode: "stock", marketValueBaseCurrency: "10.25" }],
  },
}

describe("Dashboard valuation snapshot", () => {
  it("keeps server decimal values and one as-of timestamp intact", () => {
    const snapshot = parseDashboardValuationSnapshot(payload)
    expect(snapshot.asOf).toBe(payload.asOf)
    expect(snapshot.expiresAt).toBe(payload.expiresAt)
    expect(snapshot.currentValues.get("cash")).toBe("1.0000000002")
    expect(snapshot.portfolioAllocation.holdings[0]).toEqual({ assetId: "asset-1", assetTypeCode: "stock", marketValueBaseCurrency: "10.25" })
  })

  it("uses only the snapshot FX rates", async () => {
    const snapshot = parseDashboardValuationSnapshot(payload)
    await expect(snapshotRateResolver(snapshot).resolveCurrentRate({
      sourceCurrencyCode: "EUR", destinationCurrencyCode: "USD",
    })).resolves.toEqual({ rate: "1.2345678901" })
    await expect(snapshotRateResolver(snapshot).resolveCurrentRate({
      sourceCurrencyCode: "SAR", destinationCurrencyCode: "USD",
    })).rejects.toMatchObject({ code: "rate_unavailable" })
  })

  it("preserves stale and unavailable states without replacing values with zero", () => {
    expect(parseDashboardValuationSnapshot({ ...payload, freshness: "stale" }).freshness).toBe("stale")
    const unavailable = parseDashboardValuationSnapshot({
      ...payload, freshness: "unavailable", currentValues: { cash: null }, unavailableSources: ["Cash"],
    })
    expect(unavailable.currentValues.get("cash")).toBeNull()
    expect(unavailable.unavailableSources).toEqual(["Cash"])
  })

  it("keeps one persisted allocation snapshot reusable by every client", () => {
    const desktop = parseDashboardValuationSnapshot(payload)
    const mobile = parseDashboardValuationSnapshot(payload)
    expect(desktop.asOf).toBe(mobile.asOf)
    expect(desktop.portfolioAllocation).toEqual(mobile.portfolioAllocation)
  })

  it("rejects malformed snapshot numbers", () => {
    expect(() => parseDashboardValuationSnapshot({ ...payload, rates: { "EUR/USD": 1.2 } })).toThrow("invalid")
  })

  it("rejects malformed allocation values instead of treating them as zero", () => {
    expect(() => parseDashboardValuationSnapshot({ ...payload, portfolioAllocation: { status: "complete", holdings: [{ assetId: "asset", assetTypeCode: "stock", marketValueBaseCurrency: 10 }] } })).toThrow("invalid")
  })
})
