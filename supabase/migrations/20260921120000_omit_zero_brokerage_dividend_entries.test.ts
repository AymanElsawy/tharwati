import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  new URL("./20260921120000_omit_zero_brokerage_dividend_entries.sql", import.meta.url),
  "utf8",
)
const behaviorSql = readFileSync(
  new URL("../tests/brokerage_dividend_zero_entries.sql", import.meta.url),
  "utf8",
)

const functions = [
  "add_brokerage_cash_dividend",
  "add_brokerage_dividend_reinvestment",
  "add_brokerage_partial_dividend_reinvestment",
]

describe("Brokerage dividend zero-entry migration", () => {
  it("replaces all three RPCs without changing the ledger constraints", () => {
    for (const name of functions) {
      expect(migration).toContain(`create or replace function public.${name}`)
      expect(migration).toContain(`grant execute on function public.${name}`)
    }
    expect(migration).not.toContain("alter table public.transaction_entries")
    expect(migration).not.toContain("drop constraint")
  })

  it("gates optional legs on the already-rounded variables", () => {
    expect(migration.match(/if v_tax > 0 then/g)).toHaveLength(2)
    expect(migration.match(/if v_fees > 0 then/g)).toHaveLength(2)
    expect(migration.match(/if x > 0 then/g)).toHaveLength(1)
    expect(migration.match(/if f > 0 then/g)).toHaveLength(1)
    expect(migration).toContain("v_tax := pg_catalog.round")
    expect(migration).toContain("x:=round(coalesce(p_withholding_tax,0),10)")
  })

  it("keeps gross and mode-specific settlement legs mandatory", () => {
    expect(migration.match(/'brokerage_dividend_gross'/g)).toHaveLength(3)
    for (const memo of [
      "brokerage_dividend_cash",
      "brokerage_dividend_reinvestment",
      "brokerage_dividend_partial_reinvestment",
      "brokerage_dividend_partial_cash",
    ]) expect(migration).toContain(`'${memo}'`)
    expect(migration.match(/public\.post_transaction/g)).toHaveLength(3)
  })

  it("retains validation, ownership, locking, precision, and posting behavior", () => {
    expect(migration.match(/auth\.uid\(\)/g)).toHaveLength(3)
    expect(migration.match(/account_type_code='brokerage'/g)).toHaveLength(3)
    expect(migration.match(/for update/g)).toHaveLength(3)
    expect(migration.match(/for share/g)).toHaveLength(6)
    expect(migration.match(/Net dividend must be positive/g)).toHaveLength(3)
    for (const fragment of [
      "v_gross := pg_catalog.round(p_gross_dividend, 10)",
      "v_tax := pg_catalog.round(coalesce(p_withholding_tax,0),10)",
      "v_fees := pg_catalog.round(coalesce(p_fees,0),10)",
      "g:=round(p_gross_dividend,10)",
      "x:=round(coalesce(p_withholding_tax,0),10)",
      "f:=round(coalesce(p_fees,0),10)",
      "v_reinvested := pg_catalog.round(p_reinvested_amount, 10)",
      "v_quantity := pg_catalog.round(v_reinvested / p_unit_price, 10)",
    ]) expect(migration).toContain(fragment)
  })

  it("links executable coverage for all required regression cases", () => {
    for (const label of [
      "zero tax and fees omit optional legs in all three modes",
      "tax-only dividend",
      "fee-only dividend",
      "both non-zero optional legs",
      "rounded to zero at ledger precision",
      "zero and negative net dividends",
      "cash, quantity, and cost-basis effects",
      "every persisted dividend entry has positive",
      "rolls back transaction, entries, and cash effects",
    ]) expect(behaviorSql).toContain(label)
  })
})
