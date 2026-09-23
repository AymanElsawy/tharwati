import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  resolve(
    process.cwd(),
    "../../supabase/migrations/20260923120000_add_idempotent_account_record_v2.sql"
  ),
  "utf8"
)

describe("idempotent account record migration", () => {
  it("keeps receipts private and exposes only the authenticated v2 RPC", () => {
    expect(migration).toContain("create table private.account_record_mutation_receipts")
    expect(migration).toContain("enable row level security")
    expect(migration).toContain("revoke all on schema private from public, anon, authenticated")
    expect(migration).toMatch(/revoke all on function public\.add_account_record_v2[\s\S]*from public, anon;/)
    expect(migration).toMatch(/grant execute on function public\.add_account_record_v2[\s\S]*to authenticated, service_role;/)
  })

  it("locks, hashes, replays, rejects changed payloads, and posts atomically", () => {
    expect(migration).toContain("pg_advisory_xact_lock")
    expect(migration).toContain("extensions.digest")
    expect(migration).toContain("v_receipt.request_hash <> v_request_hash")
    expect(migration).toContain("'replayed', true")
    expect(migration).toContain("v_result := public.add_account_record(")
    expect(migration.indexOf("v_result := public.add_account_record(")).toBeLessThan(
      migration.indexOf("insert into private.account_record_mutation_receipts")
    )
  })

  it("retains security-definer isolation and a fixed search path", () => {
    expect(migration).toMatch(/security definer\s+set search_path = ''/i)
    expect(migration).toContain("v_user_id uuid := auth.uid()")
    expect(migration).toContain("primary key (user_id, operation, idempotency_key)")
  })
})
