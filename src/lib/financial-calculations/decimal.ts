import type { Decimal } from "../supabase/types"

type ParsedDecimal = {
  coefficient: bigint
  scale: number
}

const decimalPattern = /^[+-]?(?:\d+)(?:\.\d+)?$/

export function parseDecimal(value: Decimal): ParsedDecimal | null {
  const input = value.trim()
  if (!decimalPattern.test(input)) return null

  const negative = input.startsWith("-")
  const unsigned = input.replace(/^[+-]/, "")
  const [integerPart, fractionalPart = ""] = unsigned.split(".")
  const digits = `${integerPart}${fractionalPart}`.replace(
    /^0+(?=\d)/,
    "",
  )
  const coefficient = BigInt(digits || "0") * (negative ? -1n : 1n)
  return { coefficient, scale: fractionalPart.length }
}

function powerOfTen(exponent: number): bigint {
  return 10n ** BigInt(exponent)
}

export function normalizeDecimal(value: Decimal): Decimal | null {
  const parsed = parseDecimal(value)
  if (!parsed) return null
  return formatDecimal(parsed.coefficient, parsed.scale)
}

export function formatDecimal(
  coefficient: bigint,
  scale: number,
): Decimal {
  const negative = coefficient < 0n
  const digits = (negative ? -coefficient : coefficient).toString()
  if (scale === 0) return `${negative ? "-" : ""}${digits}`

  const padded = digits.padStart(scale + 1, "0")
  const integerPart = padded.slice(0, -scale)
  const fractionalPart = padded.slice(-scale).replace(/0+$/, "")
  const sign = negative ? "-" : ""
  return fractionalPart
    ? `${sign}${integerPart}.${fractionalPart}`
    : `${sign}${integerPart}`
}

export function compareDecimals(
  left: Decimal,
  right: Decimal,
): number | null {
  const parsedLeft = parseDecimal(left)
  const parsedRight = parseDecimal(right)
  if (!parsedLeft || !parsedRight) return null
  const scale = Math.max(parsedLeft.scale, parsedRight.scale)
  const leftCoefficient =
    parsedLeft.coefficient * powerOfTen(scale - parsedLeft.scale)
  const rightCoefficient =
    parsedRight.coefficient * powerOfTen(scale - parsedRight.scale)
  if (leftCoefficient < rightCoefficient) return -1
  if (leftCoefficient > rightCoefficient) return 1
  return 0
}

export function addDecimals(
  left: Decimal,
  right: Decimal,
): Decimal | null {
  const parsedLeft = parseDecimal(left)
  const parsedRight = parseDecimal(right)
  if (!parsedLeft || !parsedRight) return null
  const scale = Math.max(parsedLeft.scale, parsedRight.scale)
  const coefficient =
    parsedLeft.coefficient * powerOfTen(scale - parsedLeft.scale) +
    parsedRight.coefficient * powerOfTen(scale - parsedRight.scale)
  return formatDecimal(coefficient, scale)
}

export function subtractDecimals(
  left: Decimal,
  right: Decimal,
): Decimal | null {
  const parsedRight = parseDecimal(right)
  if (!parsedRight) return null
  return addDecimals(
    left,
    formatDecimal(-parsedRight.coefficient, parsedRight.scale),
  )
}

export function multiplyDecimals(
  left: Decimal,
  right: Decimal,
): Decimal | null {
  const parsedLeft = parseDecimal(left)
  const parsedRight = parseDecimal(right)
  if (!parsedLeft || !parsedRight) return null
  return formatDecimal(
    parsedLeft.coefficient * parsedRight.coefficient,
    parsedLeft.scale + parsedRight.scale,
  )
}

export function divideDecimals(
  numerator: Decimal,
  denominator: Decimal,
  outputScale = 10,
): Decimal | null {
  const parsedNumerator = parseDecimal(numerator)
  const parsedDenominator = parseDecimal(denominator)
  if (
    !parsedNumerator ||
    !parsedDenominator ||
    parsedDenominator.coefficient === 0n ||
    outputScale < 0
  ) {
    return null
  }

  const negative =
    (parsedNumerator.coefficient < 0n) !==
    (parsedDenominator.coefficient < 0n)
  const absoluteNumerator =
    parsedNumerator.coefficient < 0n
      ? -parsedNumerator.coefficient
      : parsedNumerator.coefficient
  const absoluteDenominator =
    parsedDenominator.coefficient < 0n
      ? -parsedDenominator.coefficient
      : parsedDenominator.coefficient
  const scaledNumerator =
    absoluteNumerator *
    powerOfTen(parsedDenominator.scale + outputScale)
  const scaledDenominator =
    absoluteDenominator * powerOfTen(parsedNumerator.scale)
  const quotient = scaledNumerator / scaledDenominator
  const remainder = scaledNumerator % scaledDenominator
  const rounded =
    quotient +
    (remainder * 2n >= scaledDenominator ? 1n : 0n)
  return formatDecimal(negative ? -rounded : rounded, outputScale)
}
