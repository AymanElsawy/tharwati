import { describe, expect, it, vi } from "vitest"

import type { TypedSupabaseClient } from "../../../lib/supabase/client"
import { RepositoryError } from "../../../lib/supabase/types"
import { AccountsRepository, requireAccountDecimalText } from "./accounts.repository"

const account = {
  id: "account-1",
  user_id: "user-1",
  account_type_code: "cash",
  name: "Renamed account",
  currency_code: "USD",
  opening_balance: "100",
  notes: "Updated notes",
  is_active: true,
  bank_subtype: null,
  credit_card_limit: null,
  due_day_of_month: null,
  investment_type: null,
  balance_grams: null,
  property_type: null,
  ownership_percentage: null,
  initial_ownership_percentage: null,
  business_type: null,
  industry: null,
  metal_type: null,
  purity: null,
  purchase_date: null,
  cost_per_unit: null,
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
  it("rejects the numeric zero shape returned without a PostgreSQL text cast", () => {
    expect(() => requireAccountDecimalText(0, "opening_balance", "accounts.createAccount")).toThrowError(expect.objectContaining({ code: "database_error", message: "Account field opening_balance must be a PostgreSQL decimal string" }))
  })

  it("preserves exact decimal text beyond JavaScript safe integer precision", () => {
    expect(requireAccountDecimalText("9007199254740993.0000000001", "opening_balance", "accounts.getAccounts")).toBe("9007199254740993.0000000001")
  })
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

describe("AccountsRepository.createAccount", () => {
  it.each(["real_estate", "business"] as const)("re-reads a %s account after the valued-account RPC returns numeric legacy placeholder fields", async (accountTypeCode) => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: "valued-account", opening_balance: 0 }, error: null })
    const single = vi.fn().mockResolvedValue({ data: { ...account, id: "valued-account", account_type_code: accountTypeCode, opening_balance: "0" }, error: null })
    const builder = { eq: vi.fn(), select: vi.fn(), single }
    builder.eq.mockReturnValue(builder)
    builder.select.mockReturnValue(builder)
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) },
      rpc,
      from: vi.fn().mockReturnValue(builder),
    } as unknown as TypedSupabaseClient

    await expect(new AccountsRepository(client).createAccount({
      accountTypeCode, name: "Valued account", currencyCode: "SAR", ownershipPercentage: "100",
      valuationAmount: "500", valuedOn: "2026-08-28",
      propertyType: accountTypeCode === "real_estate" ? "villa" : null,
      businessType: accountTypeCode === "business" ? "Company" : null,
      industry: accountTypeCode === "business" ? "Software" : null,
    })).resolves.toMatchObject({ id: "valued-account", opening_balance: "0" })

    expect(rpc).toHaveBeenCalledWith("create_valued_account", expect.objectContaining({ p_valuation_amount: "500" }))
    expect(builder.select).toHaveBeenCalled()
  })
})
