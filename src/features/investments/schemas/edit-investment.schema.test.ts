import { describe, expect, it } from "vitest"
import { createEditInvestmentSchema } from "./edit-investment.schema"
import type { TranslationKey } from "@/i18n/en/translations"

const t = (key: TranslationKey) => key
const valid = { transactionId: "11111111-1111-4111-8111-111111111111", accountId: "22222222-2222-4222-8222-222222222222", accountName: "Brokerage", assetId: "33333333-3333-4333-8333-333333333333", assetName: "NVIDIA", quantity: "2.5", unitPrice: "100.25", fees: "4.50", occurredAt: "2026-08-01", notes: "Corrected" }

describe("edit investment schema", () => {
  it("accepts exact supported correction values", () => expect(createEditInvestmentSchema(t).safeParse(valid).success).toBe(true))
  it.each([["quantity", "0"], ["quantity", "-1"], ["unitPrice", "-1"], ["fees", "-1"], ["occurredAt", ""]])("rejects invalid %s", (field, value) => {
    expect(createEditInvestmentSchema(t).safeParse({ ...valid, [field]: value }).success).toBe(false)
  })
})
