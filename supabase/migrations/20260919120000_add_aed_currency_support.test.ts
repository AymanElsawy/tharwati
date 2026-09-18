import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const migration = readFileSync(new URL("./20260919120000_add_aed_currency_support.sql", import.meta.url), "utf8")

describe("AED currency migration", () => {
  it("adds active catalogue metadata and expands every current table contract", () => {
    expect(migration).toContain("('AED', 'United Arab Emirates Dirham', 'د.إ')")
    for (const constraint of [
      "profiles_base_currency_code_check",
      "financial_accounts_currency_code_check",
      "assets_currency_code_check",
      "market_prices_currency_code_check",
      "dashboard_valuation_snapshots_base_currency_code_check",
      "account_disposals_sale_currency_code_check",
      "goals_currency_code_check",
    ]) expect(migration).toContain(`drop constraint ${constraint}`)
    expect(migration.match(/'AED'/g)?.length).toBeGreaterThanOrEqual(8)
  })

  it("expands all current RPC validators without replacing their behavior or grants", () => {
    for (const name of [
      "resolve_external_brokerage_asset",
      "create_valued_account",
      "post_account_disposal_proceeds_internal",
      "add_account_disposal",
      "correct_account_disposal",
    ]) expect(migration).toContain(`'${name}'`)
    expect(migration).toContain("pg_catalog.pg_get_functiondef")
    expect(migration).toContain("Expected currency validation was not found")
  })
})
