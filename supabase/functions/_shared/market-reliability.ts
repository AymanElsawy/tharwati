/** Keep database decimal strings intact; numeric provider payloads cannot recover lost precision. */
export function positiveDecimal(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null
  if (typeof value === "number" && (!Number.isFinite(value) || value <= 0)) return null
  let text = String(value).trim()
  const exponent = /^(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(text)
  if (exponent) {
    const digits = exponent[1] + (exponent[2] ?? "")
    const point = exponent[1].length + Number(exponent[3])
    if (Math.abs(point) > 1000) return null
    text = point <= 0 ? `0.${"0".repeat(-point)}${digits}`
      : point >= digits.length ? digits + "0".repeat(point - digits.length)
      : `${digits.slice(0, point)}.${digits.slice(point)}`
  }
  return /^\d+(?:\.\d+)?$/.test(text) && /[1-9]/.test(text) ? text : null
}

export function inverseDecimal(value: string, scale = 18): string | null {
  if (!positiveDecimal(value)) return null
  const [integer, fraction = ""] = value.split(".")
  const divisor = BigInt(integer + fraction)
  const numerator = 10n ** BigInt(scale + fraction.length)
  const rounded = numerator / divisor + (numerator % divisor * 2n >= divisor ? 1n : 0n)
  if (rounded === 0n) return null
  const digits = rounded.toString().padStart(scale + 1, "0")
  return `${digits.slice(0, -scale)}.${digits.slice(-scale)}`
}

/** Bounds fetch AND response-body consumption, including transports ignoring abort. */
export async function bounded<T>(milliseconds: number, operation: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      Promise.resolve().then(() => operation(controller.signal)),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort()
          reject(new DOMException("Market data deadline exceeded", "AbortError"))
        }, Math.max(1, milliseconds))
      }),
    ])
  } finally {
    clearTimeout(timer)
    controller.abort()
  }
}

export function chunks<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = []
  for (let offset = 0; offset < values.length; offset += size) result.push(values.slice(offset, offset + size))
  return result
}
