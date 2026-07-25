import { useId, useMemo, useState } from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"

import { cn } from "@/lib/utils"

const countryCodes = [
  "AD", "AE", "AF", "AG", "AL", "AM", "AO", "AR", "AT", "AU", "AZ",
  "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BN", "BO",
  "BR", "BS", "BT", "BW", "BY", "BZ", "CA", "CD", "CF", "CG", "CH",
  "CI", "CL", "CM", "CN", "CO", "CR", "CU", "CV", "CY", "CZ", "DE",
  "DJ", "DK", "DM", "DO", "DZ", "EC", "EE", "EG", "ER", "ES", "ET",
  "FI", "FJ", "FM", "FR", "GA", "GB", "GD", "GE", "GH", "GM", "GN",
  "GQ", "GR", "GT", "GW", "GY", "HN", "HR", "HT", "HU", "ID", "IE",
  "IL", "IN", "IQ", "IR", "IS", "IT", "JM", "JO", "JP", "KE", "KG",
  "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KZ", "LA", "LB", "LC",
  "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD",
  "ME", "MG", "MH", "MK", "ML", "MM", "MN", "MR", "MT", "MU", "MV",
  "MW", "MX", "MY", "MZ", "NA", "NE", "NG", "NI", "NL", "NO", "NP",
  "NR", "NZ", "OM", "PA", "PE", "PG", "PH", "PK", "PL", "PS", "PT",
  "PW", "PY", "QA", "RO", "RS", "RU", "RW", "SA", "SB", "SC", "SD",
  "SE", "SG", "SI", "SK", "SL", "SM", "SN", "SO", "SR", "SS", "ST",
  "SV", "SY", "SZ", "TD", "TG", "TH", "TJ", "TL", "TM", "TN", "TO",
  "TR", "TT", "TV", "TZ", "UA", "UG", "US", "UY", "UZ", "VA", "VC",
  "VE", "VN", "VU", "WS", "YE", "ZA", "ZM", "ZW",
] as const

const regionNames = new Intl.DisplayNames(["en"], { type: "region" })

export interface CountryOption {
  code: (typeof countryCodes)[number]
  flag: string
  name: string
}

const countries: CountryOption[] = countryCodes
  .map((code) => ({
    code,
    flag: String.fromCodePoint(...Array.from(code, (character) => 127397 + character.charCodeAt(0))),
    name: regionNames.of(code) ?? code,
  }))
  .sort((first, second) => first.name.localeCompare(second.name))

interface CountrySelectorProps {
  onChange: (country: CountryOption | null) => void
  value: CountryOption | null
}

export function CountrySelector({ onChange, value }: CountrySelectorProps) {
  const inputId = useId()
  const listboxId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState(value?.name ?? "")

  const filteredCountries = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()

    if (!normalizedQuery || normalizedQuery === value?.name.toLocaleLowerCase()) {
      return countries
    }

    return countries.filter(
      (country) =>
        country.name.toLocaleLowerCase().includes(normalizedQuery) ||
        country.code.toLocaleLowerCase().includes(normalizedQuery),
    )
  }, [query, value])

  function selectCountry(country: CountryOption) {
    onChange(country)
    setQuery(country.name)
    setIsOpen(false)
  }

  return (
    <div className="relative text-start">
      <label
        htmlFor={inputId}
        className="mb-2 block text-sm font-medium text-[var(--color-text)]"
      >
        Country
      </label>

      <div className="relative">
        {value ? (
          <span className="pointer-events-none absolute inset-y-0 start-4 flex items-center text-xl">
            {value.flag}
          </span>
        ) : (
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 start-4 my-auto size-4 text-[var(--color-text-muted)]"
          />
        )}
        <input
          id={inputId}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          autoComplete="off"
          value={query}
          placeholder="Search for a country"
          className={cn(
            "h-12 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] pe-11 text-sm text-[var(--color-text)] outline-none transition",
            "placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-3 focus:ring-[var(--color-primary-soft)]",
            value ? "ps-12" : "ps-11",
          )}
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
            } else if (event.key === "Enter" && isOpen && filteredCountries.length === 1) {
              event.preventDefault()
              selectCountry(filteredCountries[0])
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
          aria-label="Countries"
          className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-xl"
        >
          {filteredCountries.length > 0 ? (
            filteredCountries.map((country) => (
              <button
                key={country.code}
                type="button"
                role="option"
                aria-selected={value?.code === country.code}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start text-sm text-[var(--color-text)] transition hover:bg-[var(--color-surface-subtle)] focus-visible:bg-[var(--color-surface-subtle)] focus-visible:outline-none"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectCountry(country)}
              >
                <span aria-hidden="true" className="text-xl">
                  {country.flag}
                </span>
                <span className="flex-1">{country.name}</span>
                {value?.code === country.code && (
                  <Check aria-hidden="true" className="size-4 text-[var(--color-primary)]" />
                )}
              </button>
            ))
          ) : (
            <p className="px-3 py-6 text-center text-sm text-[var(--color-text-muted)]">
              No countries found
            </p>
          )}
        </div>
      )}
    </div>
  )
}
