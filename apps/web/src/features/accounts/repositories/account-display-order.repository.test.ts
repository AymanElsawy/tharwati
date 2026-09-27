import { describe, expect, it, vi } from "vitest"

import type { TypedSupabaseClient } from "../../../lib/supabase/client"
import { AccountsRepository } from "./accounts.repository"

describe("AccountsRepository Custom order contract", () => {
  it("reads canonical IDs without changing the account list query", async () => {
    const ids = ["account-2", "account-1"]
    const abortSignal = vi.fn().mockResolvedValue({ data: ids, error: null })
    const rpc = vi.fn().mockReturnValue({ abortSignal })
    const repository = new AccountsRepository({ rpc } as unknown as TypedSupabaseClient)

    await expect(repository.getAccountCustomOrder()).resolves.toEqual(ids)
    expect(rpc).toHaveBeenCalledWith("get_account_custom_order")
  })

  it("passes expected and desired order and maps stale writes to conflict", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PT409", message: "account order changed" },
    })
    const repository = new AccountsRepository({ rpc } as unknown as TypedSupabaseClient)

    await expect(repository.reorderAccounts(["a", "b"], ["b", "a"]))
      .rejects.toMatchObject({ code: "conflict", operation: "accounts.reorderAccounts" })
    expect(rpc).toHaveBeenCalledWith("reorder_accounts", {
      p_expected_ids: ["a", "b"],
      p_ordered_ids: ["b", "a"],
    })
  })
})
