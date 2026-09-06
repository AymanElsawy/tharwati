import { describe, expect, it } from "vitest"

import componentSource from "./DashboardLayout.tsx?raw"

describe("DashboardLayout preferences", () => {
  it("keeps desktop preferences in the sidebar above logout", () => {
    expect(componentSource).toContain("{navigation(undefined, true)}")
    expect(componentSource).toContain("<LanguageSwitcher />")
    expect(componentSource).not.toContain(
      'className="flex shrink-0 items-center gap-2"'
    )
  })

  it("keeps desktop header removed while preserving mobile header", () => {
    expect(componentSource).toContain("lg:hidden")
    expect(componentSource).toContain("lg:min-h-screen")
    expect(componentSource).not.toContain("<AuthenticatedUserHeader />")
  })

  it("hides only Dashboard mobile header avatar", () => {
    expect(componentSource).toContain("useLocation")
    expect(componentSource).toContain('location.pathname === "/dashboard"')
    expect(componentSource).toContain('isDashboard ? "max-sm:hidden" : ""')
    expect(componentSource).toContain('].join(" ")}')
  })
})
