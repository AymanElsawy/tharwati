import { describe, expect, it, vi } from "vitest"

import type { TypedSupabaseClient } from "../../../lib/supabase/client"
import { RepositoryError } from "../../../lib/supabase/types"
import { AccountsRepository } from "./accounts.repository"

const account = {
  id: "account-1",
  user_id: "user-1",
  account_type_code: "cash",
  name: "Renamed account",
  institution_name: null,
  currency_code: "USD",
  opening_balance: "100",
  notes: "Updated notes",
  is_active: true,
  created_at: "2026-07-26T00:00:00Z",
  updated_at: "2026-07-26T00:00:00Z",
}

function createClient(result: {
  data: typeof account | null
  error: { code: string; message: string } | null
}) {
  const single = vi.fn().mockResolvedValue(result)
  const builder = {
    eq: vi.fn(),
    select: vi.fn(),
    single,
  }
  builder.eq.mockReturnValue(builder)
  builder.select.mockReturnValue(builder)

  const update = vi.fn().mockReturnValue(builder)
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({ update }),
  } as unknown as TypedSupabaseClient

  return { client, update }
}

describe("AccountsRepository.updateAccount", () => {
  it("surfaces the account-currency history rule as a typed business error", async () => {
    const { client } = createClient({
      data: null,
      error: {
        code: "23514",
        message:
          "This account already contains financial history. Its currency cannot be changed.",
      },
    })

    const request = new AccountsRepository(client).updateAccount(
      "account-1",
      { currencyCode: "SAR" },
    )

    await expect(request).rejects.toMatchObject({
      code: "constraint_violation",
      message:
        "This account already contains financial history. Its currency cannot be changed.",
      operation: "accounts.updateAccount",
    } satisfies Partial<RepositoryError>)
  })

  it("preserves ordinary name and notes edits", async () => {
    const { client, update } = createClient({
      data: account,
      error: null,
    })

    await expect(
      new AccountsRepository(client).updateAccount("account-1", {
        name: "Renamed account",
        notes: "Updated notes",
      }),
    ).resolves.toEqual(account)

    expect(update).toHaveBeenCalledWith({
      name: "Renamed account",
      notes: "Updated notes",
    })
  })

  it("surfaces the opening-balance history rule as a typed business error", async () => {
    const { client } = createClient({
      data: null,
      error: {
        code: "23514",
        message:
          "This account already contains financial history. Its opening balance cannot be changed.",
      },
    })

    await expect(
      new AccountsRepository(client).updateAccount("account-1", {
        openingBalance: "200",
      }),
    ).rejects.toMatchObject({
      code: "constraint_violation",
      message:
        "This account already contains financial history. Its opening balance cannot be changed.",
      operation: "accounts.updateAccount",
    } satisfies Partial<RepositoryError>)
  })
})
