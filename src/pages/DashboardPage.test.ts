import { describe, expect, it } from "vitest"

import componentSource from "./DashboardPage.tsx?raw"

describe("DashboardPage allocation layout", () => {
  it("keeps the two allocation cards side by side on desktop and stacked on mobile", () => {
    expect(componentSource).toContain("lg:grid-cols-2")
    expect(componentSource).toContain("lg:items-stretch")
  })
})
