import { z } from "zod"

import type { ExchangeRateFormValues } from "@/features/exchange-rates/types/exchange-rate-form"

const positiveDecimal = /^(?:0|[1-9]\d*)(?:\.\d{1,12})?$/

export const exchangeRateSchema: z.ZodType<
  ExchangeRateFormValues,
  ExchangeRateFormValues
> = z
  .object({
    fromCurrencyCode: z.string().min(3, "From currency is required"),
    toCurrencyCode: z.string().min(3, "To currency is required"),
    rate: z
      .string()
      .trim()
      .regex(positiveDecimal, "Enter a valid rate with up to 12 decimal places")
      .refine((value) => !/^0(?:\.0+)?$/.test(value), "Rate must be greater than zero"),
    effectiveAt: z.string().min(1, "Effective date is required"),
  })
  .refine((values) => values.fromCurrencyCode !== values.toCurrencyCode, {
    message: "From and To currencies must be different",
    path: ["toCurrencyCode"],
  })
