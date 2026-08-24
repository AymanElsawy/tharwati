import { describe, expect, it } from "vitest"

import { calculateHoldingFinancials } from "../../../lib/financial-calculations"
import {
  normalizeExistingHoldingHistoryItem,
  normalizeHoldingRow,
} from "./holdings.repository"

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

describe("normalizeExistingHoldingHistoryItem", () => {
  it("normalizes PostgREST numeric Buy entry metadata before decimal aggregation", () => {
    const item = normalizeExistingHoldingHistoryItem({
      id: "transaction-id",
      occurred_at: "2026-08-24T10:00:00Z",
      transaction_type_code: "buy",
      transaction_currency_code: "USD",
      notes: null,
      reverses_transaction_id: null,
      corrects_transaction_id: null,
      entries: [
        {
          account_id: "account-id",
          asset_id: "asset-id",
          quantity_delta: 2,
          cost_basis_delta: 100,
          account_cost_basis_delta: 5000,
          account_fx_rate: 50,
          unit_price: 50,
          memo: "brokerage_buy_asset",
        },
        {
          account_id: "account-id",
          asset_id: "asset-id",
          quantity_delta: 0,
          cost_basis_delta: 5,
          account_cost_basis_delta: 250,
          account_fx_rate: 50,
          unit_price: null,
          memo: "brokerage_buy_fee",
        },
      ],
    })

    expect(item.entries).toMatchObject([
      { quantity_delta: "2", cost_basis_delta: "100", account_cost_basis_delta: "5000", account_fx_rate: "50", unit_price: "50" },
      { quantity_delta: "0", cost_basis_delta: "5", account_cost_basis_delta: "250", account_fx_rate: "50", unit_price: null },
    ])
  })

  it("keeps the same numeric read contract for the IBKR Buy shape", () => {
    const item = normalizeExistingHoldingHistoryItem({
      id: "ibkr-buy",
      occurred_at: "2026-08-24T10:00:00Z",
      transaction_type_code: "buy",
      transaction_currency_code: "USD",
      notes: null,
      reverses_transaction_id: null,
      corrects_transaction_id: null,
      entries: [
        {
          account_id: "ibkr",
          asset_id: "nvda",
          quantity_delta: 2,
          cost_basis_delta: 200,
          account_cost_basis_delta: 200,
          account_fx_rate: null,
          unit_price: 100,
          memo: "brokerage_buy_asset",
        },
        {
          account_id: "ibkr",
          asset_id: "nvda",
          quantity_delta: 0,
          cost_basis_delta: 5,
          account_cost_basis_delta: 5,
          account_fx_rate: null,
          unit_price: null,
          memo: "brokerage_buy_fee",
        },
      ],
    })

    expect(item.entries).toMatchObject([
      { quantity_delta: "2", cost_basis_delta: "200", account_cost_basis_delta: "200", unit_price: "100" },
      { quantity_delta: "0", cost_basis_delta: "5", account_cost_basis_delta: "5", unit_price: null },
    ])
  })
})
