import { z } from "zod"

import type { Translate } from "../../../i18n/context"
import { validateQuantity } from "../../../lib/financial-calculations"
import type { AddInvestmentValues } from "../types/add-investment"

const nonNegativeDecimal = /^(?:0|\d+)(?:\.\d+)?$/

export function createAddInvestmentSchema(
  t: Translate,
): z.ZodType<AddInvestmentValues, AddInvestmentValues> {
  return z
    .object({
      accountMode: z.enum(["existing", "new"]),
      accountId: z.string(),
      newAccountTypeCode: z.string(),
      newAccountName: z.string().trim(),
      newAccountCurrencyCode: z.string(),
      newAccountInstitutionName: z.string().trim(),
      assetMode: z.enum(["existing", "new"]),
      assetId: z.string(),
      newAssetTypeCode: z.string(),
      newAssetName: z.string().trim(),
      newAssetSymbol: z.string().trim(),
      newAssetCurrencyCode: z.string(),
      newAssetExchange: z.string().trim(),
      quantity: z
        .string()
        .trim()
        .refine(
          (quantity) => validateQuantity(quantity).valid,
          t("investment.validation.positiveQuantity"),
        ),
      unit: z.string(),
      unitPrice: z
        .string()
        .trim()
        .regex(nonNegativeDecimal, t("investment.validation.validAmount")),
      fees: z
        .string()
        .trim()
        .regex(nonNegativeDecimal, t("investment.validation.validAmount")),
      occurredAt: z.string().min(1, t("investment.validation.dateRequired")),
      notes: z.string().trim(),
    })
    .superRefine((values, context) => {
      if (values.accountMode === "existing" && !values.accountId) {
        context.addIssue({
          code: "custom",
          path: ["accountId"],
          message: t("investment.validation.accountRequired"),
        })
      }
      if (values.accountMode === "new" && !values.newAccountName) {
        context.addIssue({
          code: "custom",
          path: ["newAccountName"],
          message: t("investment.validation.accountNameRequired"),
        })
      }
      if (values.assetMode === "existing" && !values.assetId) {
        context.addIssue({
          code: "custom",
          path: ["assetId"],
          message: t("investment.validation.assetRequired"),
        })
      }
      if (
        values.assetMode === "new" &&
        !["gold", "silver"].includes(values.newAssetTypeCode) &&
        !values.newAssetName
      ) {
        context.addIssue({
          code: "custom",
          path: ["newAssetName"],
          message: t("investment.validation.assetNameRequired"),
        })
      }
      if (
        values.assetMode === "new" &&
        ["stock", "etf", "bond", "cryptocurrency"].includes(
          values.newAssetTypeCode,
        ) &&
        (!values.newAssetSymbol || !values.newAssetExchange)
      ) {
        context.addIssue({
          code: "custom",
          path: ["newAssetSymbol"],
          message: t("investment.validation.marketIdentityRequired"),
        })
      }
    })
}
