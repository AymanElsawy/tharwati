import { describe, expect, it } from "vitest"

import appSource from "./App.tsx?raw"

describe("authenticated analysis routes", () => {
  it("mounts the Wealth Analysis shell at /analysis", () => {
    expect(appSource).toContain(
      'import { AnalysisPage } from "../pages/AnalysisPage"'
    )
    expect(appSource).toContain(
      '<Route path="/analysis" element={<AnalysisPage />} />'
    )
  })

  it("keeps Portfolio as its child analysis route at /portfolio", () => {
    expect(appSource).toContain(
      'import { PortfolioPage } from "../pages/PortfolioPage"'
    )
    expect(appSource).toContain(
      '<Route path="/portfolio" element={<PortfolioPage />} />'
    )
  })
})
