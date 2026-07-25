import { z } from "zod"

import type { Translate } from "../../../i18n/context"
import {
  accountTypeCodes,
  currencyCodes,
  type AccountFormValues,
} from "../types/account-form"

const openingBalancePattern = /^\d{1,18}(?:\.\d{1,2})?$/

export function createAccountSchema(
  t: Translate,
): z.ZodType<AccountFormValues, AccountFormValues> {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, t("accounts.validation.nameRequired")),
    accountTypeCode: z.enum(accountTypeCodes),
    institutionName: z.string().trim(),
    currencyCode: z.enum(currencyCodes),
    openingBalance: z
      .string()
      .trim()
      .min(1, t("accounts.validation.openingBalanceRequired"))
      .regex(
        openingBalancePattern,
        t("accounts.validation.openingBalanceInvalid"),
      ),
    notes: z.string().trim(),
    isActive: z.boolean(),
  })
}
