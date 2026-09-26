import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { LanguageContext } from "@/i18n/context"
import { PortfolioPage } from "./PortfolioPage"

vi.mock("@/features/portfolio/hooks/usePortfolioExecutive", () => ({
  usePortfolioExecutive: () => ({
    portfolio: {
      baseCurrency: "USD",
      scopeOptions: [],
      analysis: { allocation: [], isPartial: false },
      evidence: { holdings: [] },
    },
    error: null,
    isLoading: false,
    isUpdating: false,
    setActiveScopeId: vi.fn(),
    refresh: vi.fn(),
    analysis: {
      selection: {},
      risks: [],
      activeDimension: null,
      highlightedHealthFactor: null,
      selectAssetClass: vi.fn(),
      selectDimension: vi.fn(),
      selectExposure: vi.fn(),
      selectRisk: vi.fn(),
    },
    evidence: {
      holdings: [],
      custody: [],
      activity: [],
      filters: {
        holdingSearch: "",
        holdingAccountId: null,
        holdingAssetClass: null,
        holdingSort: "asset",
        holdingSortDirection: "asc",
        activityType: null,
        activityAccountId: null,
        hasInherited: false,
      },
      setHoldingSearch: vi.fn(),
      setHoldingAccountId: vi.fn(),
      setHoldingAssetClass: vi.fn(),
      toggleHoldingSort: vi.fn(),
      setActivityType: vi.fn(),
      setActivityAccountId: vi.fn(),
      holdingDetailId: null,
      setHoldingDetailId: vi.fn(),
      transactionDetailId: null,
      setTransactionDetailId: vi.fn(),
    },
  }),
}))

vi.mock("@/features/portfolio/components/PortfolioAttentionSummary", () => ({ PortfolioAttentionSummary: () => null }))
vi.mock("@/features/portfolio/components/PortfolioAllocationExplorer", () => ({ PortfolioAllocationExplorer: () => null }))
vi.mock("@/features/portfolio/components/PortfolioAnalysisContextBar", () => ({ PortfolioAnalysisContextBar: () => null }))
vi.mock("@/features/portfolio/components/PortfolioDiversificationAnalysis", () => ({ PortfolioDiversificationAnalysis: () => null }))
vi.mock("@/features/portfolio/components/PortfolioExecutiveError", () => ({ PortfolioExecutiveError: () => null }))
vi.mock("@/features/portfolio/components/PortfolioExecutiveSkeleton", () => ({ PortfolioExecutiveSkeleton: () => null }))
vi.mock("@/features/portfolio/components/PortfolioHeader", () => ({ PortfolioHeader: () => null }))
vi.mock("@/features/portfolio/components/PortfolioHealth", () => ({ PortfolioHealth: () => null }))
vi.mock("@/features/portfolio/components/PortfolioRecommendedActions", () => ({ PortfolioRecommendedActions: () => null }))
vi.mock("@/features/portfolio/components/PortfolioRiskConcentration", () => ({ PortfolioRiskConcentration: () => null }))
vi.mock("@/features/portfolio/components/PortfolioValuePerformance", () => ({ PortfolioValuePerformance: () => null }))
vi.mock("@/features/portfolio/components/PortfolioCustodyBreakdown", () => ({ PortfolioCustodyBreakdown: () => null }))
vi.mock("@/features/portfolio/components/PortfolioActivity", () => ({ PortfolioActivity: () => null }))
vi.mock("@/features/portfolio/components/PortfolioHoldingDetail", () => ({ PortfolioHoldingDetail: () => null }))

describe("PortfolioPage read-only boundary", () => {
  it("renders its live holdings section without an Add Investment CTA", () => {
    const html = renderToStaticMarkup(
      <LanguageContext.Provider
        value={{
          language: "en",
          direction: "ltr",
          setLanguage: vi.fn(),
          t: (key) => key === "investment.primaryAction" ? "Add Investment" : key,
        }}
      >
        <MemoryRouter initialEntries={["/portfolio#portfolio-holdings-title"]}>
          <PortfolioPage />
        </MemoryRouter>
      </LanguageContext.Provider>,
    )

    expect(html).not.toContain("Add Investment")
    expect(html).not.toContain('href="/assets"')
  })
})
