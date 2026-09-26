import { forwardRef, useState, type InputHTMLAttributes } from "react"
import { formatMoneyInput, normalizeMoneyInput } from "@/lib/formatting/money-input"

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: string
  onValueChange: (value: string) => void
  maxDecimals?: number
}

/** Keeps a user's in-progress text intact while exposing canonical values upstream. */
export const MoneyInput = forwardRef<HTMLInputElement, Props>(function MoneyInput(
  { value, onValueChange, maxDecimals = 2, onFocus, onBlur, ...props },
  ref,
) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <input
      {...props}
      ref={ref}
      inputMode="decimal"
      value={draft ?? formatMoneyInput(value, maxDecimals)}
      onFocus={(event) => {
        setDraft(value)
        onFocus?.(event)
      }}
      onChange={(event) => {
        const input = event.target.value
        setDraft(input)
        onValueChange(normalizeMoneyInput(input, maxDecimals) ?? input)
      }}
      onBlur={(event) => {
        setDraft(null)
        onBlur?.(event)
      }}
    />
  )
})
