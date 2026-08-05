import { describe, expect, it } from "vitest"
import type { AssetSummary } from "../../../lib/supabase/types"
import { filterInvestmentAssetCatalog } from "./investment-asset-catalog"

const assets = [
  { id: "nvda", name: "NVIDIA Corporation", symbol: "NVDA", exchange: "XNAS", currency_code: "USD" },
  { id: "saudi-etf", name: "Saudi Equity ETF", symbol: "SAETF", exchange: "XSAU", currency_code: "SAR" },
] as AssetSummary[]

describe("filterInvestmentAssetCatalog", () => {
  it("finds catalog records by ticker, name, exchange, or currency", () => {
    expect(filterInvestmentAssetCatalog(assets, "nvda").map(({ id }) => id)).toEqual(["nvda"])
    expect(filterInvestmentAssetCatalog(assets, "equity etf").map(({ id }) => id)).toEqual(["saudi-etf"])
    expect(filterInvestmentAssetCatalog(assets, "XSAU").map(({ id }) => id)).toEqual(["saudi-etf"])
  })

  it("preserves authoritative metadata", () => {
    expect(filterInvestmentAssetCatalog(assets, "USD")[0]).toBe(assets[0])
  })
})
