import { describe, expect, it } from "vitest"

import { getDashboardBreakdownItems } from "@/features/dashboard/utils/assets-breakdown"
import type { DashboardAggregate } from "@/features/dashboard/services/dashboard-aggregate.service"
import { addDecimals } from "@/lib/financial-calculations/decimal"
import componentSource from "./AssetsBreakdownCard.tsx?raw"
import netWorthCardSource from "./NetWorthCard.tsx?raw"

function aggregate(overrides: Partial<DashboardAggregate> = {}): DashboardAggregate {
  return {
    baseCurrencyCode: "USD",
    status: "complete",
    totalAssets: "100",
    totalLiabilities: "25",
    netWorth: "75",
    assetBreakdown: {
      cashAndBank: "20",
      brokerage: "30",
      goldAndSilver: "10",
      realEstate: "40",
      business: "0",
      certificates: "0",
      other: "0",
    },
    accountCount: 4,
    unavailablePairs: [],
    unavailableSources: [],
    ...overrides,
  }
}

describe("AssetsBreakdownCard", () => {
  it("uses shared aggregate category totals and percentages that sum to 100", () => {
    const items = getDashboardBreakdownItems(aggregate())
    expect(items.map((item) => [item.group, item.value])).toEqual([
      ["cashAndBank", "20"], ["brokerage", "30"], ["goldAndSilver", "10"], ["realEstate", "40"],
    ])
    expect(items.reduce((total, item) => addDecimals(total, item.percentage) ?? total, "0")).toBe("100")
  })

  it("hides zero categories and does not turn liabilities into an asset slice", () => {
    const items = getDashboardBreakdownItems(aggregate())
    expect(items.map((item) => item.group)).not.toContain("business")
    expect(items.map((item) => item.group)).not.toContain("certificates")
    expect(items.map((item) => item.value)).not.toContain("25")
  })

  it("keeps total liabilities separate from the visual asset categories", () => {
    expect(componentSource).toContain('t("dashboard.assetsBreakdown.totalLiabilities")')
    expect(componentSource).toContain("aggregate.totalLiabilities")
  })

  it("uses the existing chart library for a donut with Total Assets in its center", () => {
    expect(componentSource).toContain('from "recharts"')
    expect(componentSource).toContain("innerRadius={58}")
    expect(componentSource).toContain('t("dashboard.assetsBreakdown.totalAssets")')
    expect(componentSource).toContain("chartValue: Number(item.percentage)")
    expect(componentSource).toContain('dataKey="chartValue"')
    expect(componentSource).toContain("min-h-44")
    expect(componentSource).toContain("md:h-48 md:w-48")
    expect(componentSource).not.toContain('flex h-4 overflow-hidden')
  })

  it("uses one aligned list at every breakpoint rather than a desktop two-column legend", () => {
    expect(componentSource).toContain('grid-cols-[auto_minmax(0,1fr)_auto_auto]')
    expect(componentSource).not.toContain("sm:grid-cols-2")
    expect(componentSource).toContain("md:grid-cols-[12rem_minmax(0,1fr)]")
    expect(componentSource).toContain("grid gap-2 md:gap-3")
  })

  it("returns no slices for an incomplete aggregate", () => {
    expect(getDashboardBreakdownItems(aggregate({
      status: "incomplete",
      totalAssets: null,
      totalLiabilities: null,
      netWorth: null,
      assetBreakdown: {
        cashAndBank: null, brokerage: null, goldAndSilver: null, realEstate: null,
        business: null, certificates: null, other: null,
      },
    }))).toEqual([])
    expect(componentSource).toContain('aggregate.status === "incomplete"')
  })

  it("keeps both valid and unavailable embedded breakdown states inside Wealth Overview's one outer card", () => {
    expect(netWorthCardSource).toContain('<AssetsBreakdownCard aggregate={result} isLoading={false} embedded />')
    expect(netWorthCardSource).toContain('className="tharwati-card relative min-h-48 overflow-hidden p-6 lg:min-h-0"')
    expect(componentSource).toContain('return embedded ? <section className="min-w-0">{content}</section>')
    expect(componentSource).toContain('aggregate.status === "incomplete") return embedded ? <section className="min-w-0">')
    expect(componentSource).not.toContain('aggregate.status === "incomplete") return embedded ? <article className="tharwati-card')
  })
})
