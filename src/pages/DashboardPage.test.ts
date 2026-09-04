import { describe, expect, it } from "vitest"

import componentSource from "./DashboardPage.tsx?raw"

describe("DashboardPage section order", () => {
  it("places Wealth Overview, Goals, and Accounts Overview first in that order", () => {
    const wealthOverview = componentSource.indexOf("<NetWorthCard {...aggregate} />")
    const goals = componentSource.indexOf("<DashboardGoalsCard />")
    const accounts = componentSource.indexOf("<AccountsOverviewCard")
    const portfolioAllocation = componentSource.indexOf("<DashboardPortfolioAllocationCard")

    expect(wealthOverview).toBeGreaterThanOrEqual(0)
    expect(goals).toBeGreaterThan(wealthOverview)
    expect(accounts).toBeGreaterThan(goals)
    expect(portfolioAllocation).toBeGreaterThan(accounts)
  })

  it("uses tighter mobile-only spacing between main sections", () => {
    expect(componentSource).toContain('className="grid gap-8 sm:gap-[var(--space-section)]"')
  })
})
