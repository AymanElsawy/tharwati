import { z } from "zod"
import type { TranslationKey } from "@/i18n/en/translations"
import { validateQuantity } from "@/lib/financial-calculations"

type Translate = (key: TranslationKey) => string
const decimal = /^\d+(?:\.\d+)?$/

export function createEditInvestmentSchema(t: Translate) {
  return z.object({
    transactionId: z.string().uuid(),
    accountId: z.string().uuid(),
    accountName: z.string(),
    assetId: z.string().uuid(),
    assetName: z.string(),
    quantity: z.string().refine((value) => validateQuantity(value).valid, t("investment.validation.positiveQuantity")),
    unitPrice: z.string().regex(decimal, t("investment.validation.validAmount")),
    fees: z.string().regex(decimal, t("investment.validation.validAmount")),
    occurredAt: z.string().min(1, t("investment.validation.dateRequired")),
    notes: z.string(),
  })
}
