import { z } from "zod"
import type { Translate } from "@/i18n/context"
import type { AccountRecordFormValues } from "../types/account-record"

const positiveAmount = /^\d{1,18}(?:\.\d{1,2})?$/

export function createAccountRecordSchema(
  t: Translate
): z.ZodType<AccountRecordFormValues, AccountRecordFormValues> {
  return z.object({
    type: z.enum(["expense", "income", "transfer"]),
    accountId: z.string().min(1, t("accounts.records.validation.account")),
    toAccountId: z.string(),
    amount: z.string().refine(
      (value) => positiveAmount.test(value) && Number(value) > 0,
      t("accounts.records.validation.amount")
    ),
    receivedAmount: z.string(),
    mainCategoryId: z.string(),
    subcategoryId: z.string(),
    occurredAt: z.string().min(1, t("accounts.records.validation.date")),
    notes: z.string(),
  }).superRefine((values, context) => {
    if (values.type === "transfer") {
      if (!values.toAccountId) context.addIssue({ code: "custom", path: ["toAccountId"], message: t("accounts.records.validation.account") })
      if (values.accountId === values.toAccountId) context.addIssue({ code: "custom", path: ["toAccountId"], message: t("accounts.records.validation.differentAccounts") })
      if (!positiveAmount.test(values.receivedAmount) || Number(values.receivedAmount) <= 0) context.addIssue({ code: "custom", path: ["receivedAmount"], message: t("accounts.records.validation.amount") })
    } else if (!values.mainCategoryId || !values.subcategoryId) {
      context.addIssue({ code: "custom", path: ["subcategoryId"], message: t("accounts.records.validation.category") })
    }
  }) as z.ZodType<AccountRecordFormValues, AccountRecordFormValues>
}
