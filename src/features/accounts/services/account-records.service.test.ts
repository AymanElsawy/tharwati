import { describe, expect, it } from "vitest"

import type { AccountRecordRow } from "../repositories/account-records.repository"
import { getEffectiveAccountRecordRows, groupAccountRecordsByLocalDate, mapAccountRecordRows, mapEditableAccountRecord } from "./account-records.service"

describe("account records service", () => {
  it("maps only the transaction entry that belongs to the requested account", () => {
    const rows: AccountRecordRow[] = [
      {
        id: "transaction-1",
        occurred_at: "2026-08-19T10:00:00Z",
        transaction_type_code: "transfer",
        description: "Account transfer",
        notes: null,
        main_category_id: null,
        subcategory_id: null,
        reverses_transaction_id: null,
        corrects_transaction_id: null,
        transaction_currency_code: "USD",
        account_entries: [{
          account_id: "account-source",
          entry_side: "credit",
          account_amount: "125.50",
          account: { currency_code: "USD" },
        }],
      },
    ]

    expect(mapAccountRecordRows(rows)).toEqual([
      {
        id: "transaction-1",
        occurredAt: "2026-08-19T10:00:00Z",
        type: "transfer",
        description: "Account transfer",
        notes: null,
        mainCategoryId: null,
        subcategoryId: null,
        amount: "-125.50",
        currencyCode: "USD",
      },
    ])
  })

  it("uses the matched destination account currency for a cross-currency transfer", () => {
    const rows: AccountRecordRow[] = [{
      id: "transaction-2",
      occurred_at: "2026-08-19T11:00:00Z",
      transaction_type_code: "transfer",
      description: "Account transfer",
      notes: null,
      main_category_id: null,
      subcategory_id: null,
      reverses_transaction_id: null,
      corrects_transaction_id: null,
      transaction_currency_code: "USD",
      account_entries: [{
        account_id: "account-destination",
        entry_side: "debit",
        account_amount: "50100",
        account: { currency_code: "EGP" },
      }],
    }]

    expect(mapAccountRecordRows(rows)[0]).toMatchObject({
      amount: "50100",
      currencyCode: "EGP",
    })
  })
})

describe("editable Account Records", () => {
  const base = {
    occurred_at: "2026-08-19T10:00:00Z",
    description: "Record",
    notes: "Note",
    main_category_id: "main-category",
    subcategory_id: "subcategory",
    reverses_transaction_id: null,
    corrects_transaction_id: null,
    transaction_currency_code: "USD",
  }

  it("prefills Income and Expense account, category, time, amount, and notes", () => {
    const income = mapEditableAccountRecord({ ...base, id: "income", transaction_type_code: "income", account_entries: [{ account_id: "cash", entry_side: "debit", account_amount: "100", account: { currency_code: "USD" } }] })
    const expense = mapEditableAccountRecord({ ...base, id: "expense", transaction_type_code: "expense", account_entries: [{ account_id: "cash", entry_side: "credit", account_amount: "25", account: { currency_code: "USD" } }] })

    expect(income.values).toMatchObject({ type: "income", accountId: "cash", amount: "100", mainCategoryId: "main-category", subcategoryId: "subcategory", notes: "Note" })
    expect(expense.values).toMatchObject({ type: "expense", accountId: "cash", amount: "25", mainCategoryId: "main-category", subcategoryId: "subcategory", notes: "Note" })
  })

  it("prefills same- and cross-currency Transfer sides with their native amounts", () => {
    const sameCurrency = mapEditableAccountRecord({ ...base, id: "same", transaction_type_code: "transfer", account_entries: [{ account_id: "from-usd", entry_side: "credit", account_amount: "100", account: { currency_code: "USD" } }, { account_id: "to-usd", entry_side: "debit", account_amount: "100", account: { currency_code: "USD" } }] })
    const crossCurrency = mapEditableAccountRecord({ ...base, id: "cross", transaction_type_code: "transfer", account_entries: [{ account_id: "from-usd", entry_side: "credit", account_amount: "1000", account: { currency_code: "USD" } }, { account_id: "to-egp", entry_side: "debit", account_amount: "50100", account: { currency_code: "EGP" } }] })

    expect(sameCurrency.values).toMatchObject({ type: "transfer", accountId: "from-usd", toAccountId: "to-usd", amount: "100", receivedAmount: "100" })
    expect(crossCurrency.values).toMatchObject({ type: "transfer", accountId: "from-usd", toAccountId: "to-egp", amount: "1000", receivedAmount: "50100" })
  })

  it("normalizes stored monetary precision for edit inputs without changing the value", () => {
    const income = mapEditableAccountRecord({ ...base, id: "income-precision", transaction_type_code: "income", account_entries: [{ account_id: "cash", entry_side: "debit", account_amount: "100.0000000000", account: { currency_code: "USD" } }] })
    const transfer = mapEditableAccountRecord({ ...base, id: "transfer-precision", transaction_type_code: "transfer", account_entries: [{ account_id: "from-usd", entry_side: "credit", account_amount: "100.5000000000", account: { currency_code: "USD" } }, { account_id: "to-egp", entry_side: "debit", account_amount: "100.5500000000", account: { currency_code: "EGP" } }] })

    expect(income.values.amount).toBe("100")
    expect(transfer.values.amount).toBe("100.5")
    expect(transfer.values.receivedAmount).toBe("100.55")
  })

  it("keeps only the correction replacement in effective history", () => {
    const original = { ...base, id: "original", transaction_type_code: "expense", account_entries: [{ account_id: "cash", entry_side: "credit" as const, account_amount: "10", account: { currency_code: "USD" } }] }
    const reversal = { ...base, id: "reversal", transaction_type_code: "income", reverses_transaction_id: "original", account_entries: [{ account_id: "cash", entry_side: "debit" as const, account_amount: "10", account: { currency_code: "USD" } }] }
    const replacement = { ...base, id: "replacement", transaction_type_code: "expense", corrects_transaction_id: "original", account_entries: [{ account_id: "cash", entry_side: "credit" as const, account_amount: "12", account: { currency_code: "USD" } }] }

    expect(getEffectiveAccountRecordRows([original, reversal, replacement]).map((row) => row.id)).toEqual(["replacement"])
  })
})

it("groups local-date records and calculates their signed daily net", () => {
  const records = mapAccountRecordRows([{ id: "income", occurred_at: "2026-08-19T10:00:00Z", transaction_type_code: "income", description: "Income: Salary", notes: "Payday", main_category_id: null, subcategory_id: null, reverses_transaction_id: null, corrects_transaction_id: null, transaction_currency_code: "USD", account_entries: [{ account_id: "cash", entry_side: "debit", account_amount: "100", account: { currency_code: "USD" } }] }, { id: "expense", occurred_at: "2026-08-19T12:00:00Z", transaction_type_code: "expense", description: "Expense: Food", notes: null, main_category_id: null, subcategory_id: null, reverses_transaction_id: null, corrects_transaction_id: null, transaction_currency_code: "USD", account_entries: [{ account_id: "cash", entry_side: "credit", account_amount: "25", account: { currency_code: "USD" } }] }])
  expect(groupAccountRecordsByLocalDate(records, "en-US")).toMatchObject([{ dailyNet: "75", currencyCode: "USD", records: [{ id: "income" }, { id: "expense" }] }])
})
