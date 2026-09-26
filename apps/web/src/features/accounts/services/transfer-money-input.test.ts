import { describe, expect, it, vi } from "vitest"
import type { AccountSummary } from "@/lib/supabase/types"
import { normalizeMoneyInput } from "@/lib/formatting/money-input"
import type { Translate } from "@/i18n/context"
import { createAccountRecordSchema } from "../schemas/account-record.schema"
import { emptyAccountRecordFormValues } from "../types/account-record"
import type { TypedSupabaseClient } from "@/lib/supabase/client"
import { AccountRecordsRepository } from "../repositories/account-records.repository"

vi.mock("@/services/exchange-rates", () => ({
  exchangeRateService: { resolveCurrentRate: vi.fn().mockResolvedValue({ rate: "1.25" }) },
}))

import { estimateTransferReceived } from "./account-records.service"
import { exchangeRateService } from "@/services/exchange-rates"

describe("transfer grouped amount", () => {
  const from = { currency_code: "USD" } as AccountSummary
  const to = { currency_code: "SAR" } as AccountSummary

  it("previews 1,000 using the canonical decimal amount", async () => {
    const amount = normalizeMoneyInput("1,000")!
    expect(await estimateTransferReceived(amount, from, to)).toBe("1250")
    expect(exchangeRateService.resolveCurrentRate).toHaveBeenCalledWith({
      sourceCurrencyCode: "USD", destinationCurrencyCode: "SAR",
    })
  })

  it("keeps unavailable FX unavailable", async () => {
    vi.mocked(exchangeRateService.resolveCurrentRate).mockRejectedValueOnce(new Error("unavailable"))
    await expect(estimateTransferReceived("1000", from, to)).rejects.toThrow("unavailable")
  })

  it("submits a canonical decimal string through the account record RPC", async () => {
    const amount = normalizeMoneyInput("1,000.50")!
    const values = createAccountRecordSchema(((key: string) => key) as Translate).parse({
      ...emptyAccountRecordFormValues,
      type: "transfer",
      accountId: "source",
      toAccountId: "destination",
      amount,
      receivedAmount: "1250.63",
      occurredAt: "2026-09-26T12:00",
    })
    expect(values.amount).toBe("1000.50")
    const rpc = vi.fn().mockResolvedValue({ error: null })
    const repository = new AccountRecordsRepository({ rpc } as unknown as TypedSupabaseClient)
    await repository.addAccountRecord(values, "transfer-key")
    expect(rpc).toHaveBeenCalledWith("add_account_record_v2", expect.objectContaining({
      p_amount: "1000.50",
      p_received_amount: "1250.63",
    }))
  })
})
