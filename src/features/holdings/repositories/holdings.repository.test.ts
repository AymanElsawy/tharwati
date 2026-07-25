import { describe, expect, it } from "vitest"

import { calculateHoldingFinancials } from "../../../lib/financial-calculations"
import { normalizeHoldingRow } from "./holdings.repository"

describe("normalizeHoldingRow", () => {
  it("normalizes PostgREST numeric JSON before calculation", () => {
    const holding = normalizeHoldingRow({
      id: "23a6b9cc-7e73-4fc8-8e80-7e0ef0daf1c5",
      user_id: "user-id",
      account_id: "account-id",
      asset_id: "asset-id",
      quantity: 1,
      average_cost: 100,
      total_cost_basis: 100,
      cost_currency_code: "USD",
      notes: null,
      created_at: "2026-07-23T09:00:00Z",
      updated_at: "2026-07-23T09:00:00Z",
      asset: {
        id: "asset-id",
        name: "Gold",
        symbol: "XAU",
        asset_type_code: "commodity",
        currency_code: "USD",
        canonical_quantity_unit: "troy_ounces",
      },
      account: {
        id: "account-id",
        name: "Saudi",
        institution_name: null,
        currency_code: "USD",
      },
    })

    expect(
      calculateHoldingFinancials({
        id: holding.id,
        quantity: holding.quantity,
        averageCost: holding.average_cost,
        totalCostBasis: holding.total_cost_basis,
        costCurrencyCode: holding.cost_currency_code,
      }),
    ).toMatchObject({
      quantity: "1",
      averageCost: "100",
      totalCostBasis: "100",
      isOpen: true,
    })
  })
})
