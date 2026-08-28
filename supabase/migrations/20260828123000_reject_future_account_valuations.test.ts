import { describe, expect, it } from "vitest"

import sql from "./20260828123000_reject_future_account_valuations.sql?raw"

describe("future valuation guard migration", () => {
  it("rejects future dates for new and corrected valuations", () => {
    expect(sql).toContain("create or replace function public.add_account_valuation")
    expect(sql).toContain("create or replace function public.correct_account_valuation")
    expect(sql.match(/p_valued_on > current_date/g)).toHaveLength(2)
  })
})
