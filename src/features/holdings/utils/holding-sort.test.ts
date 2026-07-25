import { describe, expect, it } from "vitest"

import type { Decimal } from "../../../lib/supabase/types"
import type { HoldingView } from "../types/holding-view"
import { sortHoldingViews } from "./holding-sort"

function holdingView(
  id: string,
  values: {
    quantity?: Decimal
    averageCost?: Decimal | null
    totalCostBasis?: Decimal
    assetName?: string
    accountName?: string
  } = {},
): HoldingView {
  const quantity = values.quantity ?? "1"
  const averageCost =
    values.averageCost === undefined ? "1" : values.averageCost
  const totalCostBasis = values.totalCostBasis ?? "1"
  return {
    holding: {
      id,
      user_id: "user-id",
      account_id: `account-${id}`,
      asset_id: `asset-${id}`,
      quantity,
      average_cost: averageCost,
      total_cost_basis: totalCostBasis,
      cost_currency_code: "USD",
      notes: null,
      created_at: "2026-07-24T00:00:00.000Z",
      updated_at: "2026-07-24T00:00:00.000Z",
      asset: {
        id: `asset-${id}`,
        name: values.assetName ?? id,
        symbol: null,
        asset_type_code: "stock",
        currency_code: "USD",
        canonical_quantity_unit: "shares",
      },
      account: {
        id: `account-${id}`,
        name: values.accountName ?? id,
        institution_name: null,
        currency_code: "USD",
      },
    },
    financials: {
      holdingId: id,
      quantity,
      averageCost,
      totalCostBasis,
      costCurrencyCode: "USD",
      isOpen: quantity !== "0",
    },
  }
}

function ids(holdings: readonly HoldingView[]): string[] {
  return holdings.map(({ holding }) => holding.id)
}

describe("sortHoldingViews", () => {
  it("orders values beyond JavaScript safe integer precision exactly", () => {
    const holdings = [
      holdingView("larger", { quantity: "9007199254740993" }),
      holdingView("smaller", { quantity: "9007199254740992" }),
    ]

    expect(
      ids(
        sortHoldingViews(holdings, {
          key: "quantity",
          direction: "ascending",
        }),
      ),
    ).toEqual(["smaller", "larger"])
    expect(
      ids(
        sortHoldingViews(holdings, {
          key: "quantity",
          direction: "descending",
        }),
      ),
    ).toEqual(["larger", "smaller"])
  })

  it("distinguishes close fractional values exactly", () => {
    const holdings = [
      holdingView("larger", {
        totalCostBasis: "0.10000000000000002",
      }),
      holdingView("smaller", {
        totalCostBasis: "0.10000000000000001",
      }),
    ]

    expect(
      ids(
        sortHoldingViews(holdings, {
          key: "totalCost",
          direction: "ascending",
        }),
      ),
    ).toEqual(["smaller", "larger"])
  })

  it("preserves input order for equivalent decimal scales", () => {
    const holdings = [
      holdingView("first", { quantity: "1.20" }),
      holdingView("second", { quantity: "1.2" }),
    ]

    expect(
      ids(
        sortHoldingViews(holdings, {
          key: "quantity",
          direction: "descending",
        }),
      ),
    ).toEqual(["first", "second"])
  })

  it("treats null average cost as zero and sorts it stably", () => {
    const holdings = [
      holdingView("positive", { averageCost: "0.0000000001" }),
      holdingView("null", { averageCost: null }),
      holdingView("zero", { averageCost: "0" }),
    ]

    expect(
      ids(
        sortHoldingViews(holdings, {
          key: "averageCost",
          direction: "ascending",
        }),
      ),
    ).toEqual(["null", "zero", "positive"])
    expect(
      ids(
        sortHoldingViews(holdings, {
          key: "averageCost",
          direction: "descending",
        }),
      ),
    ).toEqual(["positive", "null", "zero"])
  })

  it("preserves existing text-column sorting", () => {
    const holdings = [
      holdingView("second", {
        assetName: "Zulu",
        accountName: "Alpha",
      }),
      holdingView("first", {
        assetName: "Alpha",
        accountName: "Zulu",
      }),
    ]

    expect(
      ids(
        sortHoldingViews(holdings, {
          key: "asset",
          direction: "ascending",
        }),
      ),
    ).toEqual(["first", "second"])
    expect(
      ids(
        sortHoldingViews(holdings, {
          key: "account",
          direction: "ascending",
        }),
      ),
    ).toEqual(["second", "first"])
  })
})
