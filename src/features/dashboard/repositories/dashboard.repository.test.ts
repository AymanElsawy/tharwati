import { describe, expect, it, vi } from "vitest"

import { DashboardRepository } from "@/features/dashboard/repositories/dashboard.repository"
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
})
