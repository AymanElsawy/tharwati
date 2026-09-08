import type { Translate } from "@/i18n/context"
import type { TranslationKey } from "@/i18n/en/translations"
import { GoalValidationError } from "../services/goals.service"

const validationKeys: Record<GoalValidationError["code"], TranslationKey> = {
  name_required: "goals.validation.nameRequired",
  type_invalid: "goals.validation.typeInvalid",
  custom_type_required: "goals.validation.customTypeRequired",
  target_positive: "goals.validation.targetPositive",
  currency_invalid: "goals.validation.currencyInvalid",
  saved_positive: "goals.validation.savedPositive",
  date_not_future: "goals.validation.dateNotFuture",
  amount_positive: "goals.validation.amountPositive",
}

export function goalErrorMessage(cause: unknown, t: Translate): string {
  if (cause instanceof GoalValidationError) return t(validationKeys[cause.code])
  const message = cause instanceof Error ? cause.message : ""
  if (message.includes("Withdrawal exceeds funded amount"))
    return t("goals.validation.withdrawalExceeds")
  if (message.includes("Goal must be active and unarchived"))
    return t("goals.validation.activeRequired")
  if (message.includes("currency is locked"))
    return t("goals.validation.currencyLocked")
  if (message.includes("Entry already reversed"))
    return t("goals.validation.alreadyReversed")
  if (message.includes("Correction would make funded amount negative"))
    return t("goals.validation.correctionNegative")
  return t("goals.error.action")
}
