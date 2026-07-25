import { describe, expect, it, vi } from "vitest"

import { NetWorthRepository } from "@/features/net-worth/repositories/net-worth.repository"
import { NetWorthService } from "@/features/net-worth/services/net-worth.service"
import type { TypedSupabaseClient } from "@/lib/supabase/client"

describe("NetWorthRepository", () => {
  it("isolates cash accounts to the authenticated user", async () => {
    const accountsEq = vi.fn()
    const accountsQuery = {
      select: vi.fn(),
      eq: accountsEq,
      then: (resolve: (value: unknown) => void) =>
        resolve({
          data: [{ id: "account-1", opening_balance: 125400, currency_code: "USD" }],
          error: null,
        }),
    }
    accountsQuery.select.mockReturnValue(accountsQuery)
    accountsEq.mockReturnValue(accountsQuery)

    const profileEq = vi.fn()
    const profileQuery = {
      select: vi.fn(),
      eq: profileEq,
      single: vi.fn().mockResolvedValue({
        data: { default_currency_code: "USD" },
        error: null,
      }),
    }
    profileQuery.select.mockReturnValue(profileQuery)
    profileEq.mockReturnValue(profileQuery)

    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn((table: string) =>
        table === "financial_accounts" ? accountsQuery : profileQuery,
      ),
    } as unknown as TypedSupabaseClient

    const result = await new NetWorthRepository(client).getSourceData()

    expect(accountsEq).toHaveBeenCalledWith("user_id", "user-1")
    expect(accountsEq).toHaveBeenCalledWith("account_type_code", "cash")
    expect(accountsEq).toHaveBeenCalledWith("is_active", true)
    expect(result.accounts).toHaveLength(1)
    expect(result.accounts[0]?.balance).toBe("125400")
  })

  it("decodes a PostgREST numeric balance before exact-decimal calculation", async () => {
    const accountsQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      then: (resolve: (value: unknown) => void) =>
        resolve({
          data: [{ id: "account-1", opening_balance: 125400.25, currency_code: "SAR" }],
          error: null,
        }),
    }
    accountsQuery.select.mockReturnValue(accountsQuery)
    accountsQuery.eq.mockReturnValue(accountsQuery)
    const profileQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      single: vi.fn().mockResolvedValue({
        data: { default_currency_code: "SAR" },
        error: null,
      }),
    }
    profileQuery.select.mockReturnValue(profileQuery)
    profileQuery.eq.mockReturnValue(profileQuery)
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn((table: string) =>
        table === "financial_accounts" ? accountsQuery : profileQuery,
      ),
    } as unknown as TypedSupabaseClient

    const source = await new NetWorthRepository(client).getSourceData()
    const result = await new NetWorthService({
      resolveCurrentRate: vi.fn(),
    }).calculate(source)

    expect(result).toMatchObject({
      status: "success",
      totalAssets: "125400.25",
      netWorth: "125400.25",
    })
  })
})
