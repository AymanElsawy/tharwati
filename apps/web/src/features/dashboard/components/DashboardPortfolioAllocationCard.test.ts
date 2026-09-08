import { describe, expect, it } from "vitest"

import componentSource from "./DashboardPortfolioAllocationCard.tsx?raw"

describe("DashboardPortfolioAllocationCard", () => {
  it("renders the shared snapshot allocation without invoking market or FX services", () => {
    expect(componentSource).toContain("getDashboardPortfolioAllocationItems")
    expect(componentSource).not.toContain("marketDataService")
    expect(componentSource).not.toContain("exchangeRateService")
  })

  it("uses an unavailable state for incomplete holdings", () => {
    expect(componentSource).toContain('allocation.status === "incomplete"')
    expect(componentSource).toContain('t("dashboard.portfolioAllocation.unavailable")')
  })

  it("keeps the responsive amount-and-percentage list aligned", () => {
    expect(componentSource).toContain('grid-cols-[auto_minmax(0,1fr)_auto_auto]')
    expect(componentSource).toContain("md:grid-cols-[12rem_minmax(0,1fr)]")
  })

  it("uses a donut and keeps the exact snapshot-derived investment total in its center", () => {
    expect(componentSource).toContain('from "recharts"')
    expect(componentSource).toContain("innerRadius={58}")
    expect(componentSource).toContain("addDecimals")
    expect(componentSource).toContain("chartValue: Number(item.percentage)")
    expect(componentSource).toContain('dataKey="chartValue"')
    expect(componentSource).toContain("min-h-52")
    expect(componentSource).toContain('t("dashboard.portfolioAllocation.totalInvestments")')
    expect(componentSource).not.toContain('flex h-4 overflow-hidden')
  })
})
