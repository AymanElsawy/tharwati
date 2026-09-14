import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL(
    "./20260913183000_add_wealth_allocation_target_tolerance.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("wealth allocation target tolerance migration", () => {
  it("stores one bounded decimal tolerance per user", () => {
    expect(sql).toContain(
      "create table public.wealth_allocation_target_preferences",
    );
    expect(sql).toContain(
      "user_id uuid primary key references auth.users (id) on delete cascade",
    );
    expect(sql).toContain("tolerance_percentage numeric(9, 6) not null");
    expect(sql).toContain("tolerance_percentage >= 0");
    expect(sql).toContain("tolerance_percentage <= 100");
  });

  it("isolates reads and exposes writes only through the plan RPC", () => {
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("using ((select auth.uid()) = user_id)");
    expect(sql).toContain(
      "revoke all on table public.wealth_allocation_target_preferences",
    );
    expect(sql).toContain(
      "grant select on table public.wealth_allocation_target_preferences",
    );
    expect(sql).toContain(
      "create function public.replace_wealth_allocation_plan(",
    );
    expect(sql).toContain("v_user_id uuid := auth.uid()");
    expect(sql).not.toContain("p_user_id");
  });

  it("atomically reuses target validation and saves tolerance", () => {
    expect(sql).toContain(
      "perform public.replace_wealth_allocation_targets(p_targets)",
    );
    expect(sql).toContain("on conflict (user_id) do update");
    expect(sql).toContain("p_tolerance_percentage::text !~");
    expect(sql).toContain(
      "grant execute on function public.replace_wealth_allocation_plan(jsonb, numeric)",
    );
  });

  it("preserves only the existing authenticated legacy RPC grant during rollout", () => {
    expect(sql).not.toContain(
      "revoke all on function public.replace_wealth_allocation_targets(jsonb)",
    );
    expect(sql).not.toContain(
      "grant execute on function public.replace_wealth_allocation_targets(jsonb)",
    );
    expect(sql).toContain(
      "Transitional compatibility: preserve the existing authenticated EXECUTE grant",
    );
  });
});
