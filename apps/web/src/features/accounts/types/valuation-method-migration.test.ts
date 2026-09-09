import { describe, expect, it } from "vitest"

import createSql from "@db/migrations/20260828120000_add_account_valuations.sql?raw"
import sql from "@db/migrations/20260908151347_validate_real_estate_valuation_methods.sql?raw"

describe("structured Real Estate valuation methods migration", () => {
  it("keeps both RPC signatures and hardened execution settings", () => {
    expect(sql).toContain(
      "create or replace function public.add_account_valuation("
    )
    expect(sql).toContain(
      "create or replace function public.correct_account_valuation("
    )
    expect(
      sql.match(/language plpgsql security definer set search_path = ''/g)
    ).toHaveLength(2)
    expect(sql).toContain(
      "p_account_id uuid, p_valuation_amount numeric, p_valued_on date"
    )
    expect(sql).toContain(
      "p_valuation_id uuid, p_valuation_amount numeric, p_valued_on date"
    )
  })

  it("accepts the approved Real Estate codes in add and correction", () => {
    for (const code of [
      "owner_estimate",
      "professional_appraisal",
      "market_comparison",
      "income_approach",
      "cost_approach",
      "recent_transaction",
    ]) {
      expect(
        sql.match(new RegExp(`'${code}'`, "g"))?.length
      ).toBeGreaterThanOrEqual(2)
    }
    expect(sql.match(/account_type_code = 'real_estate'/g)).toHaveLength(2)
  })

  it("normalizes meaningful Other values with Unicode-aware trimming", () => {
    expect(sql.match(/v_method like 'other:%'/g)).toHaveLength(2)
    expect(
      sql.match(
        /v_custom_method := btrim\(substring\(v_method from 7\), v_whitespace\)/g
      )
    ).toHaveLength(2)
    expect(
      sql.match(/v_method := 'other:' \|\| v_custom_method/g)
    ).toHaveLength(2)
    expect(sql).toContain("E' \\t\\n\\r\\f' || chr(11)")
    expect(sql).toContain("\\00A0")
    expect(sql).toContain("\\3000")
  })

  it("preserves Business codes and rejects unapproved values", () => {
    for (const code of [
      "revenue_multiple",
      "ebitda_multiple",
      "discounted_cash_flow",
      "asset_based",
    ]) {
      expect(sql.match(new RegExp(`'${code}'`, "g"))).toHaveLength(2)
    }
    expect(
      sql.match(/A supported Business valuation method is required/g)?.length
    ).toBeGreaterThanOrEqual(2)
    expect(
      sql.match(/A supported Real Estate valuation method is required/g)?.length
    ).toBeGreaterThanOrEqual(2)
    expect(sql).not.toContain("'Owner estimate'")
    expect(sql).not.toContain("'income_multiple'")
  })

  it("keeps nullable storage and legacy history untouched", () => {
    expect(sql).toContain(
      "v_method text := nullif(btrim(coalesce(p_valuation_method, ''), v_whitespace), '')"
    )
    expect(sql).not.toContain("alter table public.account_valuations")
    expect(sql).not.toContain("update public.account_valuations")
    expect(sql).not.toContain("delete from public.account_valuations")
  })

  it("keeps create validation delegated to add_account_valuation", () => {
    expect(createSql).toContain(
      "perform public.add_account_valuation(v_account.id, p_valuation_amount, p_valued_on, p_valuation_method, p_valuation_notes)"
    )
    expect(sql).not.toContain(
      "create or replace function public.create_valued_account"
    )
  })
})
