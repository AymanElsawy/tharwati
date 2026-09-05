import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const sql = readFileSync(
  new URL("./20260905213000_enforce_bank_subtype_shape.sql", import.meta.url),
  "utf8"
)
const constraintTest = readFileSync(
  new URL("../tests/account_bank_subtype_shape.sql", import.meta.url),
  "utf8"
)
const uniquenessTest = readFileSync(
  new URL("../tests/account_active_name_uniqueness.sql", import.meta.url),
  "utf8"
)

describe("bank subtype shape migration", () => {
  it("installs and validates the stronger constraint before replacing the canonical constraint", () => {
    expect(sql).toContain(
      "add constraint financial_accounts_bank_subtype_shape_check"
    )
    expect(sql).toContain("account_type_code = 'bank'")
    expect(sql).toContain("bank_subtype is not null")
    expect(sql).toContain("bank_subtype in ('debit', 'credit')")
    expect(sql).toContain("account_type_code <> 'bank'")
    expect(sql).toContain("bank_subtype is null")
    expect(sql).toContain(") not valid")
    expect(sql).toContain(
      "validate constraint financial_accounts_bank_subtype_shape_check"
    )
    expect(sql).toContain(
      "drop constraint financial_accounts_bank_subtype_check"
    )
    expect(sql).toContain(
      "rename constraint financial_accounts_bank_subtype_shape_check"
    )
    expect(sql).toContain("to financial_accounts_bank_subtype_check")
  })

  it("does not rewrite or infer existing account data", () => {
    expect(sql).not.toMatch(/update\s+public\.financial_accounts/i)
  })

  it("covers valid and invalid bank subtype shapes in the database test", () => {
    expect(constraintTest).toContain("Bank Debit and Bank Credit are accepted")
    expect(constraintTest).toContain("Bank with a null subtype is rejected")
    expect(constraintTest).toContain("non-bank with a subtype is rejected")
    expect(constraintTest).toContain("invalid subtype updates are rejected")
  })

  it("covers a successful cross-bank-subtype rename", () => {
    expect(uniquenessTest).toContain(
      "rename to a name used by the other Bank subtype is allowed"
    )
  })
})
