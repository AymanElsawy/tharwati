import { describe, expect, it } from "vitest"

import type { AccountRecordRow } from "../repositories/account-records.repository"
import { mapAccountRecordRows } from "./account-records.service"

describe("account records service", () => {
  it("maps only the transaction entry that belongs to the requested account", () => {
    const rows: AccountRecordRow[] = [
      {
        id: "transaction-1",
        occurred_at: "2026-08-19T10:00:00Z",
        transaction_type_code: "transfer",
        description: "Account transfer",
        transaction_currency_code: "USD",
        account_entries: [{
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
      transaction_currency_code: "USD",
      account_entries: [{
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
