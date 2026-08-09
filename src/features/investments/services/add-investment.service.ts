import type { Database } from "../../../lib/supabase/types"
import { investmentsRepository } from "../repositories/investments.repository"
import type {
  AddInvestmentResult,
  AddInvestmentValues,
} from "../types/add-investment"

function nullable(value: string): string | null {
  const normalized = value.trim()
  return normalized || null
}

function deriveAssetIdentity(values: AddInvestmentValues) {
  const category = values.newAssetTypeCode
  const symbol = values.newAssetSymbol.trim()
  const market = values.newAssetExchange.trim()

  if (category === "gold" || category === "silver") {
    const code = category === "gold" ? "XAU" : "XAG"
    return {
      assetTypeCode: "commodity",
      name: category === "gold" ? "Gold" : "Silver",
      symbol: code,
      exchange: null,
      scheme: "commodity",
      namespace: "global",
      value: code,
    }
  }

  if (["stock", "etf", "bond"].includes(category)) {
    return {
      assetTypeCode: category,
      name: values.newAssetName.trim(),
      symbol: nullable(symbol),
      exchange: nullable(market),
      scheme: "ticker",
      namespace: market || "custom",
      value: symbol,
    }
  }

  if (category === "cryptocurrency") {
    return {
      assetTypeCode: category,
      name: values.newAssetName.trim(),
      symbol: nullable(symbol),
      exchange: nullable(market),
      scheme: "crypto_native",
      namespace: market,
      value: symbol,
    }
  }

  const generatedIdentity = crypto.randomUUID()
  if (category === "real_estate") {
    return {
      assetTypeCode: category,
      name: values.newAssetName.trim(),
      symbol: nullable(symbol),
      exchange: null,
      scheme: "custom_real_estate",
      namespace: "property",
      value: generatedIdentity,
    }
  }
  if (category === "business") {
    return {
      assetTypeCode: category,
      name: values.newAssetName.trim(),
      symbol: nullable(symbol),
      exchange: null,
      scheme: "custom_business",
      namespace: "business",
      value: generatedIdentity,
    }
  }
  return {
    assetTypeCode: "other",
    name: values.newAssetName.trim(),
    symbol: nullable(symbol),
    exchange: nullable(market),
    scheme: "provider",
    namespace: "custom",
    value: generatedIdentity,
  }
}

export function buildAddInvestmentArgs(
  values: AddInvestmentValues
): Database["public"]["Functions"]["add_investment"]["Args"] {
  const newAccount = values.accountMode === "new"
  const newAsset = values.assetMode === "new"
  const assetIdentity = deriveAssetIdentity(values)
  return {
    p_account_id: newAccount ? null : values.accountId,
    p_new_account_type_code: newAccount ? values.newAccountTypeCode : null,
    p_new_account_name: newAccount ? values.newAccountName.trim() : null,
    p_new_account_currency_code: newAccount
      ? values.newAccountCurrencyCode
      : null,
    p_asset_id: newAsset ? null : values.assetId,
    p_new_asset_type_code: newAsset ? assetIdentity.assetTypeCode : null,
    p_new_asset_name: newAsset ? assetIdentity.name : null,
    p_new_asset_symbol: newAsset ? assetIdentity.symbol : null,
    p_new_asset_currency_code: newAsset ? values.newAssetCurrencyCode : null,
    p_new_asset_exchange: newAsset ? assetIdentity.exchange : null,
    p_identifier_scheme: newAsset ? assetIdentity.scheme : null,
    p_identifier_namespace: newAsset ? assetIdentity.namespace : null,
    p_identifier_value: newAsset ? assetIdentity.value : null,
    p_identifier_provider: null,
    p_funding_mode: values.fundingMode,
    p_funding_account_id:
      values.fundingMode === "cash_account" ? values.fundingAccountId : null,
    p_quantity: values.quantity.trim(),
    p_unit_price: values.unitPrice.trim(),
    p_fees: values.fees.trim() || "0",
    p_occurred_at: new Date(`${values.occurredAt}T12:00:00`).toISOString(),
    p_notes: nullable(values.notes),
  }
}

export async function addInvestment(
  values: AddInvestmentValues
): Promise<AddInvestmentResult> {
  const args = buildAddInvestmentArgs(values)
  const result = await investmentsRepository.addInvestment(args)
  window.dispatchEvent(new CustomEvent("tharwati:data-changed"))
  return result
}
