import { describe, expect, it } from "vitest"
import migration from "./20260922130000_order_account_record_history_deterministically.sql?raw"

describe("deterministic Account Record history ordering", () => {
  it("orders and paginates by occurred_at, created_at, then id", () => {
    expect(migration).toContain("t.created_at")
    expect(migration).toContain(
      "(r.occurred_at, r.created_at, r.id) < (",
    )
    expect(migration).toContain(
      "order by r.occurred_at desc, r.created_at desc, r.id desc",
    )
    expect(migration).toContain("cursor_transaction.user_id = v_user_id")
  })
})
