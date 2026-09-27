import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  resolve(process.cwd(), "../../supabase/migrations/20260927160000_add_account_display_order.sql"),
  "utf8"
)

describe("account display order migration contract", () => {
  it("keeps order isolated from financial account writes", () => {
    expect(migration).toContain("foreign key (account_id, user_id)")
    expect(migration).toContain("on delete cascade")
    expect(migration).toContain("unique (user_id, position) deferrable")
    expect(migration).not.toMatch(/create trigger/i)
    expect(migration).not.toMatch(/update public\.financial_accounts/i)
  })

  it("limits writes to authenticated RPC and handles replay before conflicts", () => {
    expect(migration).toContain("enable row level security")
    expect(migration).toContain("grant select on public.account_display_order to authenticated")
    expect(migration).toContain("grant execute on function public.reorder_accounts(uuid[], uuid[]) to authenticated")
    expect(migration.indexOf("if v_current = p_ordered_ids then"))
      .toBeLessThan(migration.indexOf("if p_expected_ids is distinct from v_current then"))
    expect(migration).toContain("errcode = 'PT409'")
  })
})
