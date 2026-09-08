import { describe, expect, it, vi } from "vitest"

import type { TypedSupabaseClient } from "@/lib/supabase/client"
import { localDateTimeInputToIso } from "@/lib/formatting/local-date-time"
import { AccountRecordsRepository } from "./account-records.repository"
import type { AccountRecordFormValues, AccountRecordHistoryFilters } from "../types/account-record"

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

  it("requests history through the server-filtered paginated effective-history RPC", async () => {
    const { repository, rpc } = createRepository()
    rpc.mockResolvedValue({ data: [], error: null })

    await repository.getAccountRecordHistory("cash-account", { occurredAt: "2026-08-20T12:00:00Z", id: "cursor-id" }, 50, "Asia/Riyadh")

    expect(rpc).toHaveBeenCalledWith("get_account_record_history", {
      p_account_id: "cash-account",
      p_cursor_occurred_at: "2026-08-20T12:00:00Z",
      p_cursor_id: "cursor-id",
      p_page_size: 50,
      p_time_zone: "Asia/Riyadh",
      p_search: null,
      p_from_date: null,
      p_to_date: null,
      p_record_type: null,
      p_main_category_id: null,
      p_subcategory_id: null,
      p_min_amount: null,
      p_max_amount: null,
    })
  })

  it("passes combined search, local-date, type, category, and native-amount filters to the RPC", async () => {
    const { repository, rpc } = createRepository()
    rpc.mockResolvedValue({ data: [], error: null })
    const filters: AccountRecordHistoryFilters = {
      search: "  gym  ",
      fromDate: "2026-08-18",
      toDate: "2026-08-21",
      recordType: "expense",
      mainCategoryId: "main-category",
      subcategoryId: "subcategory",
      minAmount: "10",
      maxAmount: "100.50",
    }

    await repository.getAccountRecordHistory("cash-account", null, 50, "Asia/Riyadh", filters)

    expect(rpc).toHaveBeenCalledWith("get_account_record_history", expect.objectContaining({
      p_search: "gym",
      p_from_date: "2026-08-18",
      p_to_date: "2026-08-21",
      p_record_type: "expense",
      p_main_category_id: "main-category",
      p_subcategory_id: "subcategory",
      p_min_amount: "10",
      p_max_amount: "100.50",
    }))
  })
})
