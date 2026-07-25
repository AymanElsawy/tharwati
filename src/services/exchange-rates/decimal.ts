import type { Decimal } from "../../lib/supabase/types"
import { ExchangeRateError } from "./errors"

const decimalPattern = /^(?:0|[1-9]\d*)(?:\.\d+)?$/
const inverseScale = 12

export function requirePositiveRate(rate: Decimal): Decimal {
  const normalized = rate.trim()
  if (!decimalPattern.test(normalized) || /^0(?:\.0+)?$/.test(normalized)) {
    throw new ExchangeRateError({
      code: "invalid_rate",
      message: `Exchange rate must be greater than zero: ${rate}`,
    })
  }
  return normalized
}

export function invertRate(rate: Decimal): Decimal {
  const normalized = requirePositiveRate(rate)
  const [whole, fraction = ""] = normalized.split(".")
  const denominator = BigInt(`${whole}${fraction}`)
  const sourceScale = 10n ** BigInt(fraction.length)
  const outputScale = 10n ** BigInt(inverseScale)
  const numerator = sourceScale * outputScale
  const quotient = numerator / denominator
  const remainder = numerator % denominator
  const rounded = quotient + (remainder * 2n >= denominator ? 1n : 0n)
  const digits = rounded.toString().padStart(inverseScale + 1, "0")
  const integer = digits.slice(0, -inverseScale)
  const decimals = digits.slice(-inverseScale).replace(/0+$/, "")
  return decimals ? `${integer}.${decimals}` : integer
}

