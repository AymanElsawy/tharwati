import { describe, expect, it } from "vitest"
import migration from "@db/migrations/20260924120000_add_idempotent_brokerage_mutations_v2.sql?raw"

const operations = ["buy","sell","cash_dividend","dividend_reinvestment","partial_dividend_reinvestment"]

describe("Brokerage mutation v2 migration", () => {
  it.each(operations)("wraps add_brokerage_%s without duplicating calculations", (operation) => {
    expect(migration).toContain(`add_brokerage_${operation}_v2`)
    expect(migration).toContain(`public.add_brokerage_${operation}(`)
  })
  it("reuses the private receipt contract with locking, hashing, and no client access", () => {
    expect(migration).not.toContain("create table")
    expect(migration).toContain("private.account_record_mutation_receipts")
    expect(migration).toContain("pg_advisory_xact_lock")
    expect(migration).toContain("extensions.digest")
    expect(migration).toContain("different request")
    expect(migration).toContain("'replayed',true")
    expect(migration).toMatch(/security definer set search_path=''/g)
    expect(migration).toContain("from public,anon")
  })
})
