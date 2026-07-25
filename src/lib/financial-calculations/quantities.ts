import type { Decimal } from "../supabase/types"
import {
  compareDecimals,
  normalizeDecimal,
  parseDecimal,
} from "./decimal"
import type {
  QuantityValidationOptions,
  QuantityValidationResult,
} from "./types"
import { FinancialCalculationError } from "./types"

export function validateQuantity(
  quantity: Decimal,
  options: QuantityValidationOptions = {},
): QuantityValidationResult {
  const parsed = parseDecimal(quantity)
  if (!parsed) return { valid: false, reason: "invalid_decimal" }
  if (
    options.maximumScale !== undefined &&
    parsed.scale > options.maximumScale
  ) {
    return { valid: false, reason: "scale_exceeded" }
  }

  const comparison = compareDecimals(quantity, "0")
  if (comparison === null) {
    return { valid: false, reason: "invalid_decimal" }
  }
  if (comparison < 0 && !options.allowNegative) {
    return { valid: false, reason: "negative" }
  }
  if (comparison === 0 && !options.allowZero) {
    return { valid: false, reason: "zero" }
  }

  return {
    valid: true,
    normalized: normalizeDecimal(quantity) as Decimal,
  }
}

export function isOpenQuantity(quantity: Decimal): boolean {
  return compareDecimals(quantity, "0") === 1
}

export function requireValidQuantity(
  quantity: Decimal,
  options?: QuantityValidationOptions,
): Decimal {
  const result = validateQuantity(quantity, options)
  if (!result.valid) {
    throw new FinancialCalculationError(
      "invalid_quantity",
      `Invalid quantity: ${result.reason}`,
    )
  }
  return result.normalized
}

