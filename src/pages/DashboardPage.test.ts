import { describe, expect, it } from "vitest"

import { ar } from "@/i18n/ar/translations"
import { en } from "@/i18n/en/translations"
import componentSource from "./DashboardPage.tsx?raw"

describe("DashboardPage composition", () => {
  it("uses approved Dashboard sections without Accounts Overview", () => {
    const wealthOverview = componentSource.indexOf(
      "<NetWorthCard {...aggregate} />"
    )
    const assetsBreakdown = componentSource.indexOf("<AssetsBreakdownCard")
    const insights = componentSource.indexOf("<DashboardKeyInsights")
    const portfolioAllocation = componentSource.indexOf(
      "<DashboardPortfolioAllocationCard"
    )
    const goals = componentSource.indexOf("<DashboardGoalsCard />")

    expect(wealthOverview).toBeGreaterThanOrEqual(0)
    expect(assetsBreakdown).toBeGreaterThan(wealthOverview)
    expect(insights).toBeGreaterThan(assetsBreakdown)
    expect(portfolioAllocation).toBeGreaterThan(insights)
    expect(goals).toBeGreaterThan(portfolioAllocation)
    expect(componentSource).not.toContain("<AccountsOverviewCard")
  })

  it("has localized date, visual-only notifications, and responsive rows", () => {
    expect(componentSource).toContain(
      'className="grid gap-8 sm:gap-[var(--space-section)]"'
    )
    expect(componentSource).toContain('dateStyle: "full"')
    expect(componentSource).toContain(
      'aria-label={t("dashboard.hero.notifications")}'
    )
    expect(componentSource).toContain('t("pages.dashboard.title")')
    expect(componentSource).toContain("tharwati-dashboard-page")
    expect(componentSource).toContain("xl:grid-cols-2")
    expect(componentSource).toContain(
      "xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
    )
  })

  it("keeps localized personalized greeting inside mountain masthead", () => {
    expect(componentSource).toContain("tharwati-dashboard-masthead")
    expect(componentSource).toContain('t("dashboard.hero.personalGreeting"')
    expect(componentSource).toContain("useCurrentUser")
    expect(componentSource).toContain("<AuthenticatedUserHeader compact />")
    expect(componentSource).toContain("flex shrink-0 items-center gap-2")
    expect(en["dashboard.hero.personalGreeting"]).toBe(
      "Good afternoon, {{name}} 👋"
    )
    expect(ar["dashboard.hero.personalGreeting"]).toBe(
      "مساء الخير، {{name}} 👋"
    )
    expect(en["pages.dashboard.title"]).toBe("Your wealth at a glance")
    expect(ar["pages.dashboard.title"]).toBe("ثروتك في لمحة")
  })
})
