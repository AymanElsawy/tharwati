import { describe, expect, it } from "vitest"

import sql from "./20260907183000_validate_business_valuation_methods.sql?raw"

describe("structured Business valuation methods migration", () => {
  it("validates approved codes in add and correction RPCs", () => {
    expect(sql).toContain(
      "create or replace function public.add_account_valuation"
    )
    expect(sql).toContain(
      "create or replace function public.correct_account_valuation"
    )
    for (const code of [
      "owner_estimate",
      "professional_appraisal",
      "market_comparison",
      "revenue_multiple",
      "ebitda_multiple",
      "discounted_cash_flow",
      "asset_based",
      "recent_transaction",
    ]) {
      expect(sql).toContain(`'${code}'`)
    }
    expect(sql).toContain("v_method like 'other:%'")
    expect(
      sql.match(
        /v_custom_method := btrim\(substring\(v_method from 7\), v_whitespace\)/g
      )
    ).toHaveLength(2)
    expect(sql.match(/nullif\(v_custom_method, ''\) is null/g)).toHaveLength(2)
    expect(sql).toContain("E' \\t\\n\\r\\f' || chr(11)")
    expect(sql).toContain("\\00A0")
    expect(sql).toContain("\\3000")
  })

  it("keeps Real Estate rejection and legacy rows unchanged", () => {
    expect(sql).toContain(
      "Valuation method is supported only for Business accounts"
    )
    expect(sql).not.toContain("alter table public.account_valuations")
    expect(sql).not.toContain("update public.account_valuations")
  })
})
