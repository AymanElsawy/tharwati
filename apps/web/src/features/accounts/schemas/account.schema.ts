import { z } from "zod"

import type { Translate } from "../../../i18n/context"
import { compareDecimals } from "../../../lib/financial-calculations/decimal"
import {
  accountTypeCodes,
  bankSubtypeCodes,
  businessTypeCodes,
  currencyCodes,
  industryCodes,
  investmentTypeCodes,
  metalTypeCodes,
  propertyTypeCodes,
  purityCodes,
  type AccountFormValues,
} from "../types/account-form"

const decimalAmountPattern = /^\d{1,18}(?:\.\d{1,2})?$/
const percentagePattern = /^\d{1,3}(?:\.\d{1,2})?$/
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/

function validateValuationDate(
  value: string,
  ctx: z.RefinementCtx,
  t: Translate,
) {
  if (!isoDatePattern.test(value)) {
    ctx.addIssue({
      code: "custom",
      path: ["valuationDate"],
      message: t("accounts.validation.valuationDateRequired"),
    })
    return
  }
  if (value > new Date().toISOString().slice(0, 10)) {
    ctx.addIssue({
      code: "custom",
      path: ["valuationDate"],
      message: t("accounts.validation.valuationDateFuture"),
    })
  }
}

export function createAccountSchema(
  t: Translate,
  mode: "create" | "edit" = "create"
): z.ZodType<AccountFormValues, AccountFormValues> {
  return z
    .object({
      name: z.string().trim(),
      accountTypeCode: z.enum(accountTypeCodes),
      currencyCode: z.enum(currencyCodes),
      openingBalance: z.string().trim(),
      bankSubtype: z.union([z.enum(bankSubtypeCodes), z.literal("")]),
      creditCardLimit: z.string().trim(),
      dueDayOfMonth: z.string().trim(),
      investmentType: z.union([z.enum(investmentTypeCodes), z.literal("")]),
      balanceGrams: z.string().trim(),
      propertyType: z.union([z.enum(propertyTypeCodes), z.literal("")]),
      ownershipPercentage: z.string().trim(),
      businessType: z.union([z.enum(businessTypeCodes), z.literal("")]),
      businessTypeOther: z.string().trim(),
      industry: z.union([z.enum(industryCodes), z.literal("")]),
      industryOther: z.string().trim(),
      location: z.string().trim(),
      valuationDate: z.string().trim(),
      valuationMethod: z.string().trim(),
      valuationNotes: z.string().trim(),
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
          if (values.bankSubtype === "credit") {
            if (
              !decimalAmountPattern.test(values.creditCardLimit) ||
              compareDecimals(values.creditCardLimit, "0") !== 1
            ) {
              ctx.addIssue({
                code: "custom",
                path: ["creditCardLimit"],
                message: t("accounts.validation.creditCardLimitInvalid"),
              })
            }
            if (
              values.dueDayOfMonth &&
              !/^(?:[1-9]|[12]\d|3[01])$/.test(values.dueDayOfMonth)
            ) {
              ctx.addIssue({
                code: "custom",
                path: ["dueDayOfMonth"],
                message: t("accounts.validation.dueDayOfMonthInvalid"),
              })
            }
            if (
              decimalAmountPattern.test(values.openingBalance) &&
              decimalAmountPattern.test(values.creditCardLimit) &&
              compareDecimals(values.openingBalance, values.creditCardLimit) ===
                1
            ) {
              ctx.addIssue({
                code: "custom",
                path: ["openingBalance"],
                message: t("accounts.validation.creditBalanceExceedsLimit"),
              })
            }
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
          if (mode === "create") requireBalance(t("accounts.validation.balanceInvalid"))
          requirePercentage()
          if (!values.propertyType) {
            ctx.addIssue({
              code: "custom",
              path: ["propertyType"],
              message: t("accounts.validation.propertyTypeRequired"),
            })
          }
          if (mode === "create") validateValuationDate(values.valuationDate, ctx, t)
          break
        }
        case "business": {
          if (mode === "create") requireBalance(t("accounts.validation.balanceInvalid"))
          requirePercentage()
          if (!values.businessType) {
            ctx.addIssue({
              code: "custom",
              path: ["businessType"],
              message: t("accounts.validation.businessTypeRequired"),
            })
          }
          if (values.businessType === "other" && !values.businessTypeOther) {
            ctx.addIssue({
              code: "custom",
              path: ["businessTypeOther"],
              message: t("accounts.validation.businessTypeOtherRequired"),
            })
          }
          if (!values.industry) {
            ctx.addIssue({
              code: "custom",
              path: ["industry"],
              message: t("accounts.validation.industryRequired"),
            })
          }
          if (values.industry === "other" && !values.industryOther) {
            ctx.addIssue({
              code: "custom",
              path: ["industryOther"],
              message: t("accounts.validation.industryOtherRequired"),
            })
          }
          if (mode === "create") validateValuationDate(values.valuationDate, ctx, t)
          break
        }
      }
    }) as z.ZodType<AccountFormValues, AccountFormValues>
}
