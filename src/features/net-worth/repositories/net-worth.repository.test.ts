import { describe, expect, it, vi } from "vitest"

import type { AccountBalance } from "@/features/account-balances/types/account-balance"
import { NetWorthRepository } from "@/features/net-worth/repositories/net-worth.repository"
import { NetWorthService } from "@/features/net-worth/services/net-worth.service"
import type { TypedSupabaseClient } from "@/lib/supabase/client"

function account(
  overrides: Partial<AccountBalance> = {},
): AccountBalance {
  return {
    accountId: "account-1",
    accountTypeCode: "cash",
    accountName: "Cash",
    currencyCode: "SAR",
    isActive: true,
    openingBalance: "100000",
    ledgerEffect: "-20100",
    currentBalance: "79900",
    ...overrides,
  }
}

function profileClient(): TypedSupabaseClient {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn().mockResolvedValue({
      data: { base_currency_code: "SAR" },
      error: null,
    }),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue(query),
  } as unknown as TypedSupabaseClient
}

describe("NetWorthRepository", () => {
  it("uses the ledger-derived current balance instead of opening balance", async () => {
    const balances = {
      getEligibleWealthCashBalances: vi
        .fn()
        .mockResolvedValue([account()]),
    }
    const result = await new NetWorthRepository(
      profileClient(),
      balances,
    ).getSourceData()

    expect(result.accounts).toEqual([
      {
        accountId: "account-1",
        balance: "79900",
        currencyCode: "SAR",
      },
    ])
  })

  it("preserves projected decimal values through Net Worth calculation", async () => {
    const balances = {
      getEligibleWealthCashBalances: vi
        .fn()
        .mockResolvedValue([
          account({ currentBalance: "79900.1250000000" }),
        ]),
    }
    const source = await new NetWorthRepository(
      profileClient(),
      balances,
    ).getSourceData()
    const result = await new NetWorthService({
      resolveCurrentRate: vi.fn(),
    }).calculate(source)

    expect(result).toMatchObject({
      status: "success",
      totalAssets: "79900.125",
      netWorth: "79900.125",
    })
  })
})
