import { describe, expect, it } from "vitest"

import type { AccountRecordHistoryRow } from "../repositories/account-records.repository"
import { groupAccountRecordsByLocalDate, mapAccountRecordHistoryPage, mapAccountRecordHistoryRows, mapEditableAccountRecord } from "./account-records.service"
import historyMigration from "../../../../supabase/migrations/20260821050000_add_paginated_account_record_history.sql?raw"
import historyFixMigration from "../../../../supabase/migrations/20260821060000_fix_account_record_history_local_date_ambiguity.sql?raw"

function historyRow(overrides: Partial<AccountRecordHistoryRow> = {}): AccountRecordHistoryRow {
  return {
    id: "transaction-1",
    occurred_at: "2026-08-19T10:00:00Z",
    transaction_type_code: "income",
    description: "Income: Salary",
    notes: "Payday",
    main_category_id: "main-category",
    subcategory_id: "subcategory",
    account_id: "cash",
    entry_side: "debit",
    account_amount: "100",
    currency_code: "USD",
    local_date: "2026-08-19",
    daily_net: "75",
    ...overrides,
  }
}

describe("Account Record history paging", () => {
  it("maps Income, Expense, and Transfer rows using the account-native signed amount", () => {
    expect(mapAccountRecordHistoryRows([
      historyRow(),
      historyRow({ id: "expense", transaction_type_code: "expense", entry_side: "credit", account_amount: "25" }),
      historyRow({ id: "transfer", transaction_type_code: "transfer", entry_side: "debit", account_amount: "50100", currency_code: "EGP" }),
    ])).toMatchObject([
      { id: "transaction-1", amount: "100", currencyCode: "USD" },
      { id: "expense", amount: "-25", currencyCode: "USD" },
      { id: "transfer", amount: "50100", currencyCode: "EGP" },
    ])
  })

  it("uses the final row as a stable occurred_at/id cursor", () => {
    const fullPage = Array.from({ length: 50 }, (_, index) => historyRow({ id: `id-${index}`, occurred_at: `2026-08-19T10:${String(59 - index).padStart(2, "0")}:00Z` }))
    const page = mapAccountRecordHistoryPage(fullPage, 50)
    expect(page).toMatchObject({ hasMore: true, nextCursor: { occurredAt: "2026-08-19T10:10:00Z", id: "id-49" } })

    expect(mapAccountRecordHistoryPage(fullPage.slice(0, 2), 50)).toMatchObject({ hasMore: false, nextCursor: { id: "id-1" } })
  })

  it("uses the complete server daily net when one local date spans pages", () => {
    const firstPage = Array.from({ length: 50 }, (_, index) => historyRow({ id: `first-${index}`, account_amount: "10", daily_net: "520" }))
    const secondPage = [
      historyRow({ id: "second-1", account_amount: "10", daily_net: "520" }),
      historyRow({ id: "second-2", account_amount: "10", daily_net: "520" }),
    ]

    const records = [...mapAccountRecordHistoryRows(firstPage), ...mapAccountRecordHistoryRows(secondPage)]
    expect(groupAccountRecordsByLocalDate(records)).toMatchObject([{ date: "2026-08-19", dailyNet: "520", currencyCode: "USD" }])
  })

  it("retains each complete server daily net when a page contains multiple local dates", () => {
    const records = mapAccountRecordHistoryRows([
      historyRow({ id: "newer", local_date: "2026-08-20", daily_net: "180", account_amount: "100" }),
      historyRow({ id: "older", local_date: "2026-08-19", daily_net: "-25", entry_side: "credit", account_amount: "25" }),
    ])

    expect(groupAccountRecordsByLocalDate(records)).toMatchObject([
      { date: "2026-08-20", dailyNet: "180" },
      { date: "2026-08-19", dailyNet: "-25" },
    ])
  })
})

describe("editable Account Records", () => {
  const detailBase = {
    occurred_at: "2026-08-19T10:00:00Z",
    description: "Record",
    notes: "Note",
    main_category_id: "main-category",
    subcategory_id: "subcategory",
    reverses_transaction_id: null,
    corrects_transaction_id: null,
    transaction_currency_code: "USD",
  }

  it("prefills Income/Expense and same/cross-currency Transfer amounts", () => {
    const income = mapEditableAccountRecord({ ...detailBase, id: "income", transaction_type_code: "income", account_entries: [{ account_id: "cash", entry_side: "debit", account_amount: "100.0000000000", account: { currency_code: "USD" } }] })
    const expense = mapEditableAccountRecord({ ...detailBase, id: "expense", transaction_type_code: "expense", account_entries: [{ account_id: "cash", entry_side: "credit", account_amount: "25", account: { currency_code: "USD" } }] })
    const transfer = mapEditableAccountRecord({ ...detailBase, id: "transfer", transaction_type_code: "transfer", account_entries: [{ account_id: "from-usd", entry_side: "credit", account_amount: "100.5000000000", account: { currency_code: "USD" } }, { account_id: "to-egp", entry_side: "debit", account_amount: "100.5500000000", account: { currency_code: "EGP" } }] })

    expect(income.values).toMatchObject({ type: "income", amount: "100" })
    expect(expense.values).toMatchObject({ type: "expense", amount: "25" })
    expect(transfer.values).toMatchObject({ type: "transfer", accountId: "from-usd", toAccountId: "to-egp", amount: "100.5", receivedAmount: "100.55" })
  })
})

describe("effective history RPC", () => {
  it("filters reversal rows, reversed originals, and corrected originals server-side", () => {
    expect(historyMigration).toContain("and t.reverses_transaction_id is null")
    expect(historyMigration).toContain("reversal.reverses_transaction_id = t.id")
    expect(historyMigration).toContain("replacement.corrects_transaction_id = t.id")
  })

  it("uses owned-account filtering and keyset pagination without an offset", () => {
    expect(historyMigration).toContain("a.user_id = v_user_id")
    expect(historyMigration).toContain("(r.occurred_at, r.id) < (p_cursor_occurred_at, p_cursor_id)")
    expect(historyMigration).toContain("order by r.occurred_at desc, r.id desc")
    expect(historyMigration).not.toMatch(/\boffset\b/i)
  })

  it("calculates complete daily totals only for the local dates in the cursor page using DST-safe UTC ranges", () => {
    expect(historyMigration).toContain("page_records as materialized")
    expect(historyMigration).toContain("page_dates as materialized")
    expect(historyMigration).toContain("page_date_ranges as materialized")
    expect(historyMigration).toContain("local_date::timestamp at time zone v_time_zone as occurred_at_start")
    expect(historyMigration).toContain("(local_date + 1)::timestamp at time zone v_time_zone as occurred_at_end")
    expect(historyMigration).toContain("r.occurred_at >= d.occurred_at_start")
    expect(historyMigration).toContain("r.occurred_at < d.occurred_at_end")
    expect(historyMigration).toContain("sum(r.signed_amount) as daily_net")
    expect(historyMigration).toContain("(t.occurred_at at time zone v_time_zone)::date as local_date")
    expect(historyMigration).toContain("p_time_zone text default 'UTC'")
    expect(historyMigration).not.toContain("over (partition by local_date)")
  })

  it("uses qualified CTE local-date references in the forward RPC fix", () => {
    expect(historyFixMigration).toContain("select distinct p.local_date")
    expect(historyFixMigration).toContain("d.local_date::timestamp at time zone v_time_zone")
    expect(historyFixMigration).toContain("(d.local_date + 1)::timestamp at time zone v_time_zone")
  })
})
