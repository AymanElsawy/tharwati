import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const sql = readFileSync(
  new URL("./20260903154245_make_account_names_unique_when_active.sql", import.meta.url),
  "utf8"
)

describe("active-only account-name uniqueness migration", () => {
  it("keeps the existing non-metal constraint name and limits it to active accounts", () => {
    expect(sql).toContain(
      "drop index public.financial_accounts_non_metal_user_name_lower_key"
    )
    expect(sql).toContain(
      "on public.financial_accounts (user_id, lower(btrim(name)))"
    )
    expect(sql).toContain("where account_type_code <> 'gold' and is_active")
  })

  it("leaves Gold/Silver uniqueness unchanged", () => {
    expect(sql).not.toContain("financial_accounts_user_currency_metal_type_key")
  })

  it("keeps reopen server-authoritative and protected by active uniqueness", () => {
    expect(sql).toContain(
      "create or replace function public.reopen_financial_account"
    )
    expect(sql).toContain("where id = p_account_id and user_id = auth.uid() for update")
    expect(sql).toContain("set search_path = ''")
    expect(sql).toContain("set is_active = true")
    expect(sql).toContain(
      "grant execute on function public.reopen_financial_account(uuid) to authenticated"
    )
  })
})
