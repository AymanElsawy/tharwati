import { z } from "zod"

import type { Translate } from "../../../i18n/context"
import {
  accountTypeCodes,
  bankSubtypeCodes,
  currencyCodes,
  investmentTypeCodes,
  metalTypeCodes,
  propertyTypeCodes,
  purityCodes,
  type AccountFormValues,
} from "../types/account-form"

const decimalAmountPattern = /^\d{1,18}(?:\.\d{1,2})?$/
const percentagePattern = /^\d{1,3}(?:\.\d{1,2})?$/

export function createAccountSchema(
  t: Translate
): z.ZodType<AccountFormValues, AccountFormValues> {
  return z
    .object({
      name: z.string().trim(),
      accountTypeCode: z.enum(accountTypeCodes),
      currencyCode: z.enum(currencyCodes),
      openingBalance: z.string().trim(),
      bankSubtype: z.union([z.enum(bankSubtypeCodes), z.literal("")]),
      investmentType: z.union([z.enum(investmentTypeCodes), z.literal("")]),
      balanceGrams: z.string().trim(),
      propertyType: z.union([z.enum(propertyTypeCodes), z.literal("")]),
      ownershipPercentage: z.string().trim(),
      businessType: z.string().trim(),
      industry: z.string().trim(),
      metalType: z.union([z.enum(metalTypeCodes), z.literal("")]),
      purity: z.union([z.enum(purityCodes), z.literal("")]),
      purchaseDate: z.string().trim(),
      costPerUnit: z.string().trim(),
      notes: z.string().trim(),
      isActive: z.boolean(),
    })
    .superRefine((values, ctx) => {
      const requireBalance = (message: string) => {
        if (!values.openingBalance) {
          ctx.addIssue({
            code: "custom",
            path: ["openingBalance"],
            message: t("accounts.validation.balanceRequired"),
          })
        } else if (!decimalAmountPattern.test(values.openingBalance)) {
          ctx.addIssue({ code: "custom", path: ["openingBalance"], message })
        }
      }
      const requirePercentage = () => {
        if (!values.ownershipPercentage) {
          ctx.addIssue({
            code: "custom",
            path: ["ownershipPercentage"],
            message: t("accounts.validation.ownershipPercentageRequired"),
          })
          return
        }
        if (
          !percentagePattern.test(values.ownershipPercentage) ||
          Number(values.ownershipPercentage) > 100
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["ownershipPercentage"],
            message: t("accounts.validation.ownershipPercentageInvalid"),
          })
        }
      }

      if (values.accountTypeCode !== "gold" && !values.name) {
        ctx.addIssue({
          code: "custom",
          path: ["name"],
          message: t("accounts.validation.nameRequired"),
        })
      }

      switch (values.accountTypeCode) {
        case "cash":
        case "other": {
          requireBalance(t("accounts.validation.balanceInvalid"))
          break
        }
        case "bank": {
          requireBalance(t("accounts.validation.balanceInvalid"))
          if (!values.bankSubtype) {
            ctx.addIssue({
              code: "custom",
              path: ["bankSubtype"],
              message: t("accounts.validation.bankSubtypeRequired"),
            })
          }
          break
        }
        case "brokerage": {
          requireBalance(t("accounts.validation.balanceInvalid"))
          if (!values.investmentType) {
            ctx.addIssue({
              code: "custom",
              path: ["investmentType"],
              message: t("accounts.validation.investmentTypeRequired"),
            })
          }
          break
        }
        case "gold": {
          if (!values.metalType) {
            ctx.addIssue({
              code: "custom",
              path: ["metalType"],
              message: t("accounts.validation.metalTypeRequired"),
            })
          }
          break
        }
        case "real_estate": {
          requireBalance(t("accounts.validation.balanceInvalid"))
          requirePercentage()
          if (!values.propertyType) {
            ctx.addIssue({
              code: "custom",
              path: ["propertyType"],
              message: t("accounts.validation.propertyTypeRequired"),
            })
          }
          break
        }
        case "business": {
          requireBalance(t("accounts.validation.balanceInvalid"))
          requirePercentage()
          if (!values.businessType) {
            ctx.addIssue({
              code: "custom",
              path: ["businessType"],
              message: t("accounts.validation.businessTypeRequired"),
            })
          }
          if (!values.industry) {
            ctx.addIssue({
              code: "custom",
              path: ["industry"],
              message: t("accounts.validation.industryRequired"),
            })
          }
          break
        }
      }
    }) as z.ZodType<AccountFormValues, AccountFormValues>
}
