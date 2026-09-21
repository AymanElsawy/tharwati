import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { LanguageContext } from "@/i18n/context"
import type { AccountSummary } from "@/lib/supabase/types"
import { createAccountRecordSchema } from "../schemas/account-record.schema"
import { emptyAccountRecordFormValues } from "../types/account-record"
import { normalizeTransferValues } from "../utils/transfer-form-values"
import { TransferAccountSelectors } from "./TransferAccountSelectors"

const accounts = [
  {
    id: "cash-id",
    name: "Cash",
    account_type_code: "cash",
    currency_code: "SAR",
  },
  {
    id: "bank-id",
    name: "Bank",
    account_type_code: "bank",
    currency_code: "SAR",
  },
  {
    id: "usd-id",
    name: "USD",
    account_type_code: "cash",
    currency_code: "USD",
  },
] as AccountSummary[]

function renderedOptions(
  fromAccountId: string,
  toAccountId: string,
  name: string,
  availableAccounts = accounts
) {
  const markup = renderToStaticMarkup(
    <LanguageContext.Provider
      value={{
        language: "en",
        direction: "ltr",
        setLanguage: () => undefined,
        t: (key) => key,
      }}
    >
      <TransferAccountSelectors
        accounts={availableAccounts}
        fromAccountId={fromAccountId}
        toAccountId={toAccountId}
        onFromAccountChange={() => undefined}
        onToAccountChange={() => undefined}
      />
    </LanguageContext.Provider>
  )
  const select = markup.match(
    new RegExp(`<select(?=[^>]*name="${name}")[\\s\\S]*?</select>`)
  )?.[0]

  return [...(select ?? "").matchAll(/<option value="([^"]*)"/g)].map(
    ([, value]) => value
  )
}

describe("TransferAccountSelectors", () => {
  it("opens Transfer with the page account selected only on From", () => {
    const values = normalizeTransferValues({
      ...emptyAccountRecordFormValues,
      type: "transfer",
      accountId: "cash-id",
    })
    expect(values.toAccountId).toBe("")
    expect(
      renderedOptions(values.accountId, values.toAccountId, "toAccountId")
    ).toEqual(["", "bank-id", "usd-id"])
  })

  it("normalizes a stale duplicate pair before rendering Transfer", () => {
    const values = normalizeTransferValues({
      ...emptyAccountRecordFormValues,
      type: "transfer",
      accountId: "cash-id",
      toAccountId: "cash-id",
    })
    expect(values).toMatchObject({ accountId: "cash-id", toAccountId: "" })
    expect(
      renderedOptions(values.accountId, values.toAccountId, "toAccountId")
    ).not.toContain("cash-id")
  })

  it("leaves the opposite selector empty with one eligible account", () => {
    expect(
      renderedOptions("cash-id", "", "toAccountId", accounts.slice(0, 1))
    ).toEqual([""])
  })

  it("shows a required destination error instead of a duplicate error while empty", () => {
    const schema = createAccountRecordSchema((key) => key)
    const result = schema.safeParse({
      ...emptyAccountRecordFormValues,
      type: "transfer",
      accountId: "cash-id",
      amount: "1",
      receivedAmount: "1",
      occurredAt: "2026-09-19T12:00",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain(
        "accounts.records.validation.account"
      )
      expect(result.error.issues.map((issue) => issue.message)).not.toContain(
        "accounts.records.validation.differentAccounts"
      )
    }
  })

  it("renders the actual To selector without the selected From account", () => {
    expect(renderedOptions("cash-id", "", "toAccountId")).toEqual([
      "",
      "bank-id",
      "usd-id",
    ])
  })

  it("updates each rendered opposite selector when either selection changes", () => {
    expect(renderedOptions("bank-id", "", "toAccountId")).toEqual([
      "",
      "cash-id",
      "usd-id",
    ])
    expect(renderedOptions("", "usd-id", "accountId")).toEqual([
      "",
      "cash-id",
      "bank-id",
    ])
  })
})
