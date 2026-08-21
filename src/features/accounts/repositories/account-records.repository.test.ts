import { describe, expect, it, vi } from "vitest"

import type { TypedSupabaseClient } from "@/lib/supabase/client"
import { localDateTimeInputToIso } from "@/lib/formatting/local-date-time"
import { AccountRecordsRepository } from "./account-records.repository"
import type { AccountRecordFormValues } from "../types/account-record"

function createRepository() {
  const rpc = vi.fn().mockResolvedValue({ error: null })
  const client = { rpc } as unknown as TypedSupabaseClient
  return { repository: new AccountRecordsRepository(client), rpc }
}

describe("AccountRecordsRepository.addAccountRecord", () => {
  const baseValues: AccountRecordFormValues = {
    type: "income",
    accountId: "account-source",
    toAccountId: "",
    amount: "125.50",
    receivedAmount: "",
    mainCategoryId: "main-category",
    subcategoryId: "subcategory",
    occurredAt: "2026-08-21T09:30",
    notes: "  Record note  ",
  }

  it("preserves the public add RPC payload for income and expense", async () => {
    const { repository, rpc } = createRepository()

    await repository.addAccountRecord(baseValues)
    await repository.addAccountRecord({ ...baseValues, type: "expense" })

    expect(rpc).toHaveBeenNthCalledWith(1, "add_account_record", {
      p_record_type: "income",
      p_account_id: "account-source",
      p_counterparty_account_id: null,
      p_amount: "125.50",
      p_received_amount: null,
      p_occurred_at: localDateTimeInputToIso("2026-08-21T09:30"),
      p_category: null,
      p_notes: "Record note",
      p_main_category_id: "main-category",
      p_subcategory_id: "subcategory",
    })
    expect(rpc).toHaveBeenNthCalledWith(2, "add_account_record", expect.objectContaining({
      p_record_type: "expense",
      p_counterparty_account_id: null,
      p_received_amount: null,
    }))
  })

  it("preserves same-currency and cross-currency transfer payloads", async () => {
    const { repository, rpc } = createRepository()

    await repository.addAccountRecord({
      ...baseValues,
      type: "transfer",
      toAccountId: "account-destination",
      receivedAmount: "125.50",
    })
    await repository.addAccountRecord({
      ...baseValues,
      type: "transfer",
      toAccountId: "account-destination",
      receivedAmount: "50100",
    })

    expect(rpc).toHaveBeenNthCalledWith(1, "add_account_record", expect.objectContaining({
      p_record_type: "transfer",
      p_account_id: "account-source",
      p_counterparty_account_id: "account-destination",
      p_amount: "125.50",
      p_received_amount: "125.50",
      p_main_category_id: null,
      p_subcategory_id: null,
    }))
    expect(rpc).toHaveBeenNthCalledWith(2, "add_account_record", expect.objectContaining({
      p_record_type: "transfer",
      p_received_amount: "50100",
      p_main_category_id: null,
      p_subcategory_id: null,
    }))
  })

  it("sends immutable correction and reversal commands through their public RPCs", async () => {
    const { repository, rpc } = createRepository()

    await repository.correctAccountRecord("original-record", {
      ...baseValues,
      type: "transfer",
      toAccountId: "account-destination",
      receivedAmount: "50100",
    })
    await repository.reverseAccountRecord("original-record")

    expect(rpc).toHaveBeenNthCalledWith(1, "correct_account_record", expect.objectContaining({
      p_transaction_id: "original-record",
      p_record_type: "transfer",
      p_account_id: "account-source",
      p_counterparty_account_id: "account-destination",
      p_amount: "125.50",
      p_received_amount: "50100",
      p_main_category_id: null,
      p_subcategory_id: null,
    }))
    expect(rpc).toHaveBeenNthCalledWith(2, "reverse_account_record", {
      p_transaction_id: "original-record",
    })
  })
})
