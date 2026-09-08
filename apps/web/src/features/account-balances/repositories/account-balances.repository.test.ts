import { describe, expect, it, vi } from "vitest"

import { AccountBalancesRepository } from "@/features/account-balances/repositories/account-balances.repository"
import type { TypedSupabaseClient } from "@/lib/supabase/client"

describe("AccountBalancesRepository", () => {
  it("reads the exact posted-ledger projection returned by PostgreSQL", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          account_id: "account-1",
          account_type_code: "cash",
          account_name: "SAR Cash",
          currency_code: "SAR",
          is_active: true,
          opening_balance: "100000.00",
          ledger_effect: "-20100.0000000000",
          current_balance: "79900.0000000000",
        },
      ],
      error: null,
    })
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      rpc,
    } as unknown as TypedSupabaseClient

    const balances =
      await new AccountBalancesRepository(client).getAccountBalances()

    expect(rpc).toHaveBeenCalledWith("get_account_balances", {
      p_account_ids: null,
    })
    expect(balances[0]).toMatchObject({
      openingBalance: "100000.00",
      ledgerEffect: "-20100.0000000000",
      currentBalance: "79900.0000000000",
    })
  })

  it("preserves Brokerage available-cash projections returned by PostgreSQL", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          account_id: "brokerage-opening",
          account_type_code: "brokerage",
          account_name: "Opening only",
          currency_code: "USD",
          is_active: true,
          opening_balance: "1000",
          ledger_effect: "0",
          current_balance: "1000",
        },
        {
          account_id: "brokerage-posted-debit",
          account_type_code: "brokerage",
          account_name: "Brokerage debit",
          currency_code: "USD",
          is_active: true,
          opening_balance: "1000",
          ledger_effect: "250",
          current_balance: "1250",
        },
        {
          account_id: "brokerage-posted-credit",
          account_type_code: "brokerage",
          account_name: "Brokerage credit",
          currency_code: "USD",
          is_active: true,
          opening_balance: "1000",
          ledger_effect: "-400",
          current_balance: "600",
        },
        {
          account_id: "cash",
          account_type_code: "cash",
          account_name: "Cash",
          currency_code: "USD",
          is_active: true,
          opening_balance: "500",
          ledger_effect: "-25",
          current_balance: "475",
        },
      ],
      error: null,
    })
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      rpc,
    } as unknown as TypedSupabaseClient

    const balances = await new AccountBalancesRepository(client).getAccountBalances()

    expect(balances).toEqual(expect.arrayContaining([
      expect.objectContaining({ accountId: "brokerage-opening", currentBalance: "1000" }),
      expect.objectContaining({ accountId: "brokerage-posted-debit", ledgerEffect: "250", currentBalance: "1250" }),
      expect.objectContaining({ accountId: "brokerage-posted-credit", ledgerEffect: "-400", currentBalance: "600" }),
      expect.objectContaining({ accountId: "cash", ledgerEffect: "-25", currentBalance: "475" }),
    ]))
  })

  it("rejects lossy non-string numeric projection values", async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            account_id: "account-1",
            account_type_code: "cash",
            account_name: "Cash",
            currency_code: "SAR",
            is_active: true,
            opening_balance: 100000,
            ledger_effect: "-20100",
            current_balance: "79900",
          },
        ],
        error: null,
      }),
    } as unknown as TypedSupabaseClient

    await expect(
      new AccountBalancesRepository(client).getAccountBalances(),
    ).rejects.toThrow("opening_balance is not a PostgreSQL decimal")
  })
})
