import { describe, expect, it, vi } from "vitest"

import { DashboardRepository, requireDecimalText } from "@/features/dashboard/repositories/dashboard.repository"
import type { TypedSupabaseClient } from "@/lib/supabase/client"

describe("DashboardRepository", () => {
  it("queries only authenticated-user posted transactions", async () => {
    const chain = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
    chain.select.mockReturnValue(chain)
    chain.eq.mockReturnValue(chain)
    chain.order.mockReturnValue(chain)
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue(chain),
    } as unknown as TypedSupabaseClient

    await new DashboardRepository(
      client,
    ).getRecentPostedTransactions(5)

    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-1")
    expect(chain.eq).toHaveBeenCalledWith("status", "posted")
    expect(chain.limit).toHaveBeenCalledWith(5)
  })

  it("rejects the numeric runtime shape that previously reached activity formatting", () => {
    expect(() => requireDecimalText(1250.75, "transaction_amount")).toThrow(
      "must be a PostgreSQL decimal string",
    )
  })

  it("preserves exact decimal text beyond JavaScript safe-integer precision", () => {
    const value = "9007199254740993.000000000123456789"
    expect(requireDecimalText(value, "transaction_amount")).toBe(value)
  })
})
