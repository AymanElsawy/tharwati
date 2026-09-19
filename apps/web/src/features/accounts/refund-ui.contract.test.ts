import { describe, expect, it } from "vitest"
import type { AccountSummary } from "@/lib/supabase/types"
import {
  eligibleRefundAccounts,
  getAccountRecordCategoryPath,
} from "./services/account-records.service"
import page from "./pages/AccountRecordsPage.tsx?raw"
import form from "./components/AccountRecordFormDialog.tsx?raw"
import refund from "./components/ExpenseRefundDialog.tsx?raw"
import cancelRefund from "./components/CancelExpenseRefundDialog.tsx?raw"

describe("Refund UI", () => {
  const accounts = [
    {
      id: "a",
      is_active: true,
      account_type_code: "cash",
      currency_code: "USD",
    },
    {
      id: "b",
      is_active: true,
      account_type_code: "bank",
      currency_code: "USD",
    },
    {
      id: "c",
      is_active: true,
      account_type_code: "cash",
      currency_code: "EUR",
    },
    {
      id: "d",
      is_active: false,
      account_type_code: "cash",
      currency_code: "USD",
    },
  ] as unknown as AccountSummary[]
  it("allows only active same-currency Cash/Bank destinations", () =>
    expect(eligibleRefundAccounts(accounts, "USD").map((a) => a.id)).toEqual([
      "a",
      "b",
    ]))
  it("defaults amount to remaining and blocks over-remaining", () => {
    expect(refund).toContain("normalizeDecimal(summary.remainingRefundableAmount)")
    expect(refund).toContain(
      "compareDecimals(normalizedAmount, summary.remainingRefundableAmount)"
    )
  })
  it("uses normalized decimal values, an exact remaining preview, and a category path", () => {
    expect(refund).toContain(
      "normalizeDecimal(summary.remainingRefundableAmount)"
    )
    expect(refund).toContain(
      "subtractDecimals(summary.remainingRefundableAmount, normalizedAmount)"
    )
    expect(
      getAccountRecordCategoryPath(
        {
          id: "record",
          type: "expense",
          occurredAt: "",
          isEditable: true,
          description: "",
          notes: null,
          mainCategoryId: "food",
          subcategoryId: "cafe",
          amount: "100",
          currencyCode: "SAR",
          localDate: "",
          dailyNet: "",
        },
        [
          {
            id: "food",
            name: "Food & Drinks",
            sortOrder: 0,
            subcategories: [{ id: "cafe", name: "Café & Bar", sortOrder: 0 }],
          },
        ]
      )
    ).toBe("Food & Drinks → Café & Bar")
  })
  it("opens the Refund dialog above Edit Record while guarding only actual unsaved edits", () => {
    expect(form).toContain("hasUnsavedChanges")
    expect(form).toContain("saveBeforeRefund")
    expect(refund).toContain("z-[140]")
    expect(page).not.toContain("Add refund")
  })
  it("creates, refreshes, cancels, and labels Refund without treating it as Income", () => {
    expect(page).toContain("await addExpenseRefund")
    expect(page).toContain("await cancelExpenseRefund")
    expect(page).toContain("await loadInitialRecords()")
    expect(page).toContain('record?.type === "refund"')
    expect(page).toContain('record.type === "refund"')
    expect(page).toContain('t("accounts.records.refund")')
    expect(page).not.toContain("refund_cancellation")
  })
  it("requires explicit custom confirmation before cancelling a Refund", () => {
    expect(page).not.toContain("window.confirm")
    expect(page).toContain("setRefundToCancel(record)")
    expect(cancelRefund).toContain('t("accounts.records.keepRefund")')
    expect(cancelRefund).toContain('variant="destructive"')
    expect(cancelRefund).toContain("destinationAccountName")
  })
})
