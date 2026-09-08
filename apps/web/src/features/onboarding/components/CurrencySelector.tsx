import { useId, useMemo, useState } from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"

import { currencies, type CurrencyOption } from "@/features/onboarding/data/currencies"

interface CurrencySelectorProps {
  options?: CurrencyOption[]
  onChange: (currency: CurrencyOption | null) => void
  value: CurrencyOption | null
}

export function CurrencySelector({
  onChange,
  options = currencies,
  value,
}: CurrencySelectorProps) {
  const inputId = useId()
  const listboxId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState(value?.code ?? "")

  const filteredCurrencies = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()

    if (
      !normalizedQuery ||
      normalizedQuery === value?.code.toLocaleLowerCase() ||
      normalizedQuery === value?.name.toLocaleLowerCase()
    ) {
      return options
    }

    return options.filter(
      (currency) =>
        currency.code.toLocaleLowerCase().includes(normalizedQuery) ||
        currency.name.toLocaleLowerCase().includes(normalizedQuery) ||
        currency.symbol?.toLocaleLowerCase().includes(normalizedQuery),
    )
  }, [options, query, value])

  function selectCurrency(currency: CurrencyOption) {
    onChange(currency)
    setQuery(currency.code)
    setIsOpen(false)
  }

  return (
    <div className="relative text-start">
      <label
        htmlFor={inputId}
        className="mb-2 block text-sm font-medium text-[var(--color-text)]"
      >
        Base currency
      </label>

      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 start-4 my-auto size-4 text-[var(--color-text-muted)]"
        />
        <input
          id={inputId}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          autoComplete="off"
          value={query}
          placeholder="Search by currency code or name"
          className="h-12 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] ps-11 pe-11 text-sm text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-3 focus:ring-[var(--color-primary-soft)]"
          onBlur={() => {
            window.setTimeout(() => setIsOpen(false), 100)
          }}
          onChange={(event) => {
            setQuery(event.target.value)
            onChange(null)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setIsOpen(false)
            } else if (event.key === "Enter" && isOpen && filteredCurrencies.length === 1) {
              event.preventDefault()
              selectCurrency(filteredCurrencies[0])
            }
          }}
        />
        <ChevronsUpDown
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 end-4 my-auto size-4 text-[var(--color-text-muted)]"
        />
      </div>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Currencies"
          className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-xl"
        >
          {filteredCurrencies.length > 0 ? (
            filteredCurrencies.map((currency) => (
              <button
                key={currency.code}
                type="button"
                role="option"
                aria-selected={value?.code === currency.code}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start text-sm text-[var(--color-text)] transition hover:bg-[var(--color-surface-subtle)] focus-visible:bg-[var(--color-surface-subtle)] focus-visible:outline-none"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectCurrency(currency)}
              >
                <span className="w-12 font-semibold text-[var(--color-primary)]">
                  {currency.code}
                </span>
                <span className="flex-1">{currency.name}</span>
                {currency.symbol && (
                  <span className="text-[var(--color-text-muted)]">{currency.symbol}</span>
                )}
                {value?.code === currency.code && (
                  <Check aria-hidden="true" className="size-4 text-[var(--color-primary)]" />
                )}
              </button>
            ))
          ) : (
            <p className="px-3 py-6 text-center text-sm text-[var(--color-text-muted)]">
              No currencies found
            </p>
          )}
        </div>
      )}
    </div>
  )
}
