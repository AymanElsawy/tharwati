import { describe, expect, it } from "vitest"

import componentSource from "./AccountsOverviewCard.tsx?raw"

describe("AccountsOverviewCard", () => {
  it("renders compact responsive account-filter links", () => {
    expect(componentSource).toContain("dashboardAccountsOverviewRoute(item.group)")
    expect(componentSource).toContain("sm:grid-cols-2 lg:grid-cols-3")
    expect(componentSource).toContain("min-h-36")
  })

  it("shows one base-currency current value or an honest unavailable state", () => {
    expect(componentSource).toContain('t("dashboard.accountsOverview.totalCurrentValue")')
    expect(componentSource).toContain('t("dashboard.accountsOverview.currentValueUnavailable")')
    expect(componentSource).not.toContain("currencyTotals")
  })
})
