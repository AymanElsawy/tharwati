import { describe, expect, it } from "vitest"

import disposalSql from "./20260902160326_add_account_disposal_proceeds.sql?raw"
import valuationSql from "./20260828120000_add_account_valuations.sql?raw"
import balanceSql from "./20260822150000_add_brokerage_available_cash.sql?raw"

describe("account disposal proceeds migration", () => {
  it("replaces the old callable signatures and requires a destination for positive proceeds", () => {
    expect(disposalSql).toContain(
      "drop function public.add_account_disposal(uuid, date, numeric, text, numeric, text)"
    )
    expect(disposalSql).toContain(
      "drop function public.correct_account_disposal(uuid, date, numeric, text, numeric, text)"
    )
    expect(disposalSql).toContain("p_destination_account_id uuid")
    expect(disposalSql).toContain("p_idempotency_key uuid")
    expect(disposalSql).toContain("p_destination_account_id uuid default null")
    expect(disposalSql).toContain(
      "A destination account is required for positive sale proceeds"
    )
    expect(disposalSql).toContain(
      "A zero-proceeds disposal cannot have a destination account"
    )
  })

  it("serializes idempotent adds and rejects changed replay payloads", () => {
    expect(disposalSql).toContain(
      "account_disposals_user_idempotency_key_idx"
    )
    expect(disposalSql).toContain("pg_catalog.pg_advisory_xact_lock")
    expect(disposalSql).toContain("where user_id = v_user_id and idempotency_key = p_idempotency_key")
    expect(disposalSql).toContain(
      "Idempotency key was already used with different disposal data"
    )
  })

  it("rejects non-finite and over-precision amounts before canonical storage", () => {
    expect(disposalSql).toContain(
      "lower(p_sale_amount::text) in ('nan', 'infinity', '-infinity')"
    )
    expect(disposalSql).toContain(
      "p_sale_amount <> trunc(p_sale_amount, 2)"
    )
    expect(disposalSql).toContain("v_sale_amount numeric(20, 2)")
    expect(disposalSql).toContain(
      "v_sale_amount, p_sale_currency_code, p_disposed_on"
    )
    expect(disposalSql).toContain(
      "p_sale_amount, p_sale_amount, 'account_disposal_proceeds_received'"
    )
  })

  it("accepts only active owned Cash or Bank destinations in the sale currency", () => {
    expect(disposalSql).toContain("user_id = v_user_id")
    expect(disposalSql).toContain("and is_active")
    expect(disposalSql).toContain("account_type_code in ('cash', 'bank')")
    expect(disposalSql).toContain(
      "v_destination.currency_code <> p_sale_currency_code"
    )
  })

  it("uses a dedicated immutable classification and association", () => {
    const postingFunction =
      disposalSql.match(
        /create function public\.post_account_disposal_proceeds_internal\([\s\S]*?\n\$\$;/
      )?.[0] ?? ""
    expect(disposalSql).toContain(
      "'account_disposal_proceeds', 'Account disposal proceeds'"
    )
    expect(disposalSql).toContain("proceeds_account_id uuid")
    expect(disposalSql).toContain("proceeds_transaction_id uuid")
    expect(disposalSql).toContain(
      "account_disposals_prevent_proceeds_link_changes"
    )
    expect(postingFunction).toContain("'account_disposal_proceeds'")
    expect(postingFunction).not.toContain("'income'")
    expect(postingFunction).not.toContain("'owner_contribution'")
  })

  it("posts balanced proceeds through the immutable ledger balance projection", () => {
    expect(disposalSql).toContain("v_destination.id, 'debit'")
    expect(disposalSql).toContain("v_user_id, null, 'credit'")
    expect(disposalSql).toContain("public.post_transaction(v_transaction.id)")
    expect(balanceSql).toContain("when 'debit' then entries.account_amount")
  })

  it("keeps Real Estate full-only and Business partial/full projection behavior", () => {
    expect(disposalSql).toContain(
      "public.recalculate_account_disposal_projection(p_account_id)"
    )
    expect(valuationSql).toContain("Real Estate supports full sale only")
    expect(valuationSql).toContain(
      "v_remaining := v_remaining - v_disposal.ownership_percentage_sold"
    )
    expect(valuationSql).toContain(
      "closed_reason = case when v_remaining = 0 then 'sold'"
    )
  })

  it("keeps the deposit, disposal, and projection in one rollback boundary", () => {
    const addFunction =
      disposalSql.match(
        /create function public\.add_account_disposal\([\s\S]*?\n\$\$;/
      )?.[0] ?? ""
    expect(addFunction).toContain("post_account_disposal_proceeds_internal")
    expect(addFunction).toContain("insert into public.account_disposals")
    expect(addFunction).toContain("recalculate_account_disposal_projection")
    expect(addFunction).not.toContain("exception when")
  })

  it("blocks correction when the effective disposal already allocated proceeds", () => {
    expect(disposalSql).toContain(
      "v_original.proceeds_transaction_id is not null"
    )
    expect(disposalSql).toContain(
      "account_disposal_correction_blocked:allocated_proceeds"
    )
  })
})
