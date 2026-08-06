import { describe, expect, it } from "vitest"

import { PortfolioAnalysisService } from "./portfolio-analysis.service"
import type {
  PortfolioAnalysisHolding,
  PortfolioAnalyticalSelection,
} from "../types/portfolio-analysis"
import { addDecimals } from "@/lib/financial-calculations/decimal"

function holding(
  id: string,
  options: Partial<PortfolioAnalysisHolding> = {},
): PortfolioAnalysisHolding {
  return {
    id,
    assetClass: "stock",
    accountId: "account-a",
    currencyCode: "USD",
    marketValueBase: "10",
    name: `Holding ${id}`,
    symbol: id.toUpperCase(),
    missingMarketPrice: false,
    ...options,
  }
}

function percentageTotal(values: string[]) {
  return values.reduce((total, value) => {
    const result = addDecimals(total, value)
    if (result === null) throw new Error("Invalid test percentage")
    return result
  }, "0")
}

describe("PortfolioAnalysisService", () => {
  const service = new PortfolioAnalysisService()

  it("builds exact allocation values whose percentages sum to 100", () => {
    const analysis = service.build({
      holdings: [
        holding("one", { marketValueBase: "60" }),
        holding("two", {
          assetClass: "etf",
          marketValueBase: "30",
        }),
        holding("three", {
          assetClass: "commodity",
          marketValueBase: "10",
        }),
      ],
      baseCurrency: "SAR",
      cashValue: "20",
      accountNames: new Map([["account-a", "Brokerage"]]),
      partial: false,
    })

    expect(analysis.allocation.map((item) => item.value)).toEqual([
      "60",
      "30",
      "20",
      "10",
    ])
    expect(
      percentageTotal(
        analysis.allocation.map((item) => item.percentage),
      ),
    ).toBe("100")
  })

  it("keeps partial valuation explicit and never values missing holdings", () => {
    const analysis = service.build({
      holdings: [
        holding("valued", { marketValueBase: "100" }),
        holding("missing", {
          marketValueBase: null,
          missingMarketPrice: true,
        }),
      ],
      baseCurrency: "SAR",
      cashValue: "0",
      accountNames: new Map([["account-a", "Brokerage"]]),
      partial: true,
    })

    expect(analysis.isPartial).toBe(true)
    expect(analysis.allocation[0].value).toBe("100")
    expect(
      analysis.risks.find((risk) => risk.id === "largest_holding")
        ?.provisional,
    ).toBe(true)
    expect(
      analysis.risks.find((risk) => risk.id === "unpriced_exposure")
        ?.contributorIds,
    ).toEqual(["missing"])
  })

  it("marks unsupported classification dimensions unavailable", () => {
    const analysis = service.build({
      holdings: [holding("one")],
      baseCurrency: "SAR",
      cashValue: "0",
      accountNames: new Map(),
      partial: false,
    })

    expect(
      analysis.diversification.find(
        (dimension) => dimension.id === "sector",
      ),
    ).toMatchObject({
      status: "unavailable",
      missingClassificationCount: 1,
    })
    expect(
      analysis.risks.find((risk) => risk.id === "illiquid_exposure"),
    ).toMatchObject({ available: false, severity: "unavailable" })
  })

  it("recalculates supported diversification within an asset-class filter", () => {
    const analysis = service.build({
      holdings: [
        holding("usd-stock", { marketValueBase: "70" }),
        holding("sar-stock", {
          currencyCode: "SAR",
          marketValueBase: "30",
        }),
        holding("eur-etf", {
          assetClass: "etf",
          currencyCode: "EUR",
          marketValueBase: "100",
        }),
      ],
      baseCurrency: "SAR",
      cashValue: "0",
      accountNames: new Map(),
      partial: false,
    })
    const selection: PortfolioAnalyticalSelection = {
      assetClassId: "stock",
      dimension: "currency",
      exposureId: null,
      riskId: null,
    }

    const dimension = service.filteredDimension(
      analysis,
      selection,
      "SAR",
    )

    expect(dimension.exposures.map((item) => item.id)).toEqual([
      "USD",
      "SAR",
    ])
    expect(
      percentageTotal(
        dimension.exposures.map((item) => item.percentage),
      ),
    ).toBe("100")
  })

  it("applies exposure filters to deterministic risk thresholds", () => {
    const analysis = service.build({
      holdings: [
        holding("one", { marketValueBase: "70" }),
        holding("two", {
          currencyCode: "SAR",
          marketValueBase: "20",
        }),
        holding("three", {
          currencyCode: "SAR",
          marketValueBase: "10",
        }),
      ],
      baseCurrency: "SAR",
      cashValue: "0",
      accountNames: new Map(),
      partial: false,
    })
    const risks = service.filteredRisks(
      analysis,
      {
        assetClassId: "stock",
        dimension: "currency",
        exposureId: "SAR",
        riskId: null,
      },
      "SAR",
    )

    expect(
      risks.find((risk) => risk.id === "largest_holding"),
    ).toMatchObject({
      percentage: "66.66666667",
      severity: "high",
    })
    expect(
      risks.find((risk) => risk.id === "top_five")?.percentage,
    ).toBe("100")
  })
})
