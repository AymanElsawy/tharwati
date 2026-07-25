import { describe, expect, it } from "vitest"

import { buildAddInvestmentArgs } from "./add-investment.service"
import {
  defaultAddInvestmentValues,
  type AddInvestmentValues,
} from "../types/add-investment"

function values(
  overrides: Partial<AddInvestmentValues>,
): AddInvestmentValues {
  return { ...defaultAddInvestmentValues, ...overrides }
}

describe("buildAddInvestmentArgs", () => {
  it("reuses explicitly selected account and asset IDs", () => {
    const result = buildAddInvestmentArgs(
      values({
        accountId: "account-id",
        assetId: "asset-id",
        quantity: "2.5",
        unitPrice: "100.25",
        fees: "4.50",
      }),
    )

    expect(result.p_account_id).toBe("account-id")
    expect(result.p_asset_id).toBe("asset-id")
    expect(result.p_new_account_name).toBeNull()
    expect(result.p_new_asset_name).toBeNull()
    expect(result.p_quantity).toBe("2.5")
    expect(result.p_fees).toBe("4.50")
  })

  it("passes new account and canonical asset identity without ownership", () => {
    const result = buildAddInvestmentArgs(
      values({
        accountMode: "new",
        newAccountName: "Brokerage",
        assetMode: "new",
        newAssetName: "Apple",
        newAssetSymbol: " AAPL ",
        newAssetExchange: "XNAS",
        quantity: "1",
        unitPrice: "200",
      }),
    )

    expect(result.p_account_id).toBeNull()
    expect(result.p_new_account_name).toBe("Brokerage")
    expect(result.p_asset_id).toBeNull()
    expect(result.p_identifier_namespace).toBe("XNAS")
    expect(result.p_identifier_scheme).toBe("ticker")
    expect(result.p_identifier_value).toBe("AAPL")
    expect(result.p_new_asset_symbol).toBe("AAPL")
    expect(result).not.toHaveProperty("p_account_fx_rate")
    expect(result).not.toHaveProperty("user_id")
    expect(result).not.toHaveProperty("holding_id")
    expect(result).not.toHaveProperty("average_cost")
    expect(result).not.toHaveProperty("status")
  })

  it("maps Gold to the internal canonical commodity identity", () => {
    const result = buildAddInvestmentArgs(
      values({
        accountId: "account-id",
        assetMode: "new",
        newAssetTypeCode: "gold",
        newAssetCurrencyCode: "USD",
        quantity: "1",
        unitPrice: "2400",
      }),
    )

    expect(result.p_new_asset_type_code).toBe("commodity")
    expect(result.p_new_asset_name).toBe("Gold")
    expect(result.p_new_asset_symbol).toBe("XAU")
    expect(result.p_identifier_scheme).toBe("commodity")
    expect(result.p_identifier_value).toBe("XAU")
  })

  it("preserves selected EGP currencies in the RPC payload", () => {
    const result = buildAddInvestmentArgs(
      values({
        accountMode: "new",
        newAccountName: "Egypt Account",
        newAccountCurrencyCode: "EGP",
        assetMode: "new",
        newAssetTypeCode: "gold",
        newAssetCurrencyCode: "EGP",
        quantity: "1",
        unitPrice: "100",
      }),
    )

    expect(result.p_new_account_currency_code).toBe("EGP")
    expect(result.p_new_asset_currency_code).toBe("EGP")
    expect(result.p_identifier_value).toBe("XAU")
  })
})
