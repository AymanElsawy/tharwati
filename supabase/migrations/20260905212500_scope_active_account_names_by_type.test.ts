import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const sql = readFileSync(
  new URL(
    "./20260905212500_scope_active_account_names_by_type.sql",
    import.meta.url
  ),
  "utf8"
)
const databaseTest = readFileSync(
  new URL("../tests/account_active_name_uniqueness.sql", import.meta.url),
  "utf8"
)

describe("account-name uniqueness by account type migration", () => {
  it("replaces active non-metal name uniqueness with type-scoped uniqueness", () => {
    expect(sql).toContain(
      "drop index public.financial_accounts_non_metal_user_name_lower_key"
    )
    expect(sql).toContain("user_id")
    expect(sql).toContain("lower(btrim(name))")
    expect(sql).toContain("account_type_code")
    expect(sql).toContain("coalesce(bank_subtype, '')")
    expect(sql).toContain("where account_type_code <> 'gold' and is_active")
  })

  it("preserves Gold/Silver uniqueness", () => {
    expect(sql).not.toContain("financial_accounts_user_currency_metal_type_key")
  })

  it("leaves reopening server-authoritative while documenting scoped conflicts", () => {
    expect(sql).not.toContain("create or replace function")
    expect(sql).toContain("comment on function public.reopen_financial_account")
  })

  it("covers create normalization and both reopen outcomes in the database test", () => {
    expect(databaseTest).toContain(
      "same active name is allowed for Bank Debit and Bank Credit"
    )
    expect(databaseTest).toContain(
      "same active normalized name and same account type is rejected"
    )
    expect(databaseTest).toContain(
      "same-type case and whitespace variants are rejected"
    )
    expect(databaseTest).toContain(
      "reopen succeeds when only a different account type has the name"
    )
    expect(databaseTest).toContain(
      "reopen rejects same normalized name and same account type"
    )
  })
})
