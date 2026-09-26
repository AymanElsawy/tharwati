/** Accept plain decimals or correctly grouped thousands; preserve entered scale. */
export function normalizeMoneyInput(value: string, maxDecimals = 2): string | null {
  const match = /^(\d+|\d{1,3}(?:,\d{3})+)(?:\.(\d+))?$/.exec(value)
  if (!match || (match[2]?.length ?? 0) > maxDecimals) return null
  return match[1].replaceAll(",", "") + (match[2] === undefined ? "" : `.${match[2]}`)
}

export function formatMoneyInput(value: string, maxDecimals = 2): string {
  const canonical = normalizeMoneyInput(value, maxDecimals)
  if (canonical === null) return value
  const [integer, fraction] = canonical.split(".")
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (fraction === undefined ? "" : `.${fraction}`)
}

export function isPositiveMoneyInput(value: string, maxDecimals = 2): boolean {
  const canonical = normalizeMoneyInput(value, maxDecimals)
  return canonical !== null && /[1-9]/.test(canonical)
}

/** Keep an old validation message out of the way while an amount is being cleared. */
export function visibleMoneyInputError(
  value: string,
  error: string | undefined,
  suppressEmptyError: boolean
): string | undefined {
  return value === "" && suppressEmptyError ? undefined : error
}
