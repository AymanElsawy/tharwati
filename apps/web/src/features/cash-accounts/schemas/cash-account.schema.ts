import { z } from "zod"

import type { CashAccountFormValues } from "@/features/cash-accounts/types/cash-account-form"

const balancePattern = /^\d{1,18}(?:\.\d{1,2})?$/

export const cashAccountSchema: z.ZodType<
  CashAccountFormValues,
  CashAccountFormValues
> = z.object({
  name: z.string().trim().min(1, "Account name is required"),
  currencyCode: z.string().trim().min(3, "Currency is required"),
  balance: z
    .string()
    .trim()
    .min(1, "Current balance is required")
    .regex(balancePattern, "Enter a non-negative balance with up to 2 decimal places"),
  notes: z.string().trim(),
})
