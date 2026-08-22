import { z } from "zod"

import type { Translate } from "@/i18n/context"
import { getPurityOptions } from "../types/account-form"
import type { MetalPurchaseFormValues } from "../types/metal-purchase"

const amountPattern = /^\d{1,18}(?:\.\d{1,2})?$/
const gramsPattern = /^\d{1,18}(?:\.\d{1,3})?$/

export function createMetalPurchaseSchema(
  metalType: "gold" | "silver",
  t: Translate
): z.ZodType<MetalPurchaseFormValues, MetalPurchaseFormValues> {
  return z.object({
    purity: z
      .string()
      .trim()
      .refine(
        (value) =>
          getPurityOptions(metalType).some((option) => option.value === value),
        t("accounts.validation.purityRequired")
      ),
    purchaseDate: z
      .string()
      .trim()
      .min(1, t("accounts.validation.purchaseDateRequired")),
    unitsGrams: z
      .string()
      .trim()
      .refine(
        (value) => gramsPattern.test(value) && Number(value) > 0,
        t("accounts.validation.balanceGramsInvalid")
      ),
    costPerUnit: z
      .string()
      .trim()
      .refine(
        (value) => amountPattern.test(value) && Number(value) > 0,
        t("accounts.validation.costPerUnitInvalid")
      ),
    fees: z
      .string()
      .trim()
      .refine(
        (value) => value === "" || (amountPattern.test(value) && Number(value) >= 0),
        t("accounts.validation.feesInvalid")
      ),
    paidFromAccount: z.boolean(),
    fundingAccountId: z.string(),
    notes: z.string(),
  }).superRefine((values, ctx) => {
    if (values.paidFromAccount && !values.fundingAccountId) {
      ctx.addIssue({
        code: "custom",
        path: ["fundingAccountId"],
        message: t("accounts.metalPurchase.fundingAccountRequired"),
      })
    }
  }) as z.ZodType<MetalPurchaseFormValues, MetalPurchaseFormValues>
}
