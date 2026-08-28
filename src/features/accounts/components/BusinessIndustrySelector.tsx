import { Check, ChevronDown, Search } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { useTranslation } from "@/i18n/useTranslation"
import type { TranslationKey } from "@/i18n/en/translations"

type Option = { value: string; labelKey: TranslationKey }

/** A client-only, reusable searchable picker for stable business-domain codes. */
export function BusinessIndustrySelector({
  id,
  value,
  options,
  disabled,
  onChange,
}: {
  id: string
  value: string
  options: readonly Option[]
  disabled: boolean
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()
  const rootRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const selected = options.find((option) => option.value === value) ?? null
  const visibleOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return normalizedQuery
      ? options.filter((option) => t(option.labelKey).toLocaleLowerCase().includes(normalizedQuery))
      : options
  }, [options, query, t])

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])

  return (
    <div ref={rootRef} className="relative mt-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id={id}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={`${id}-options`}
          aria-expanded={isOpen}
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 ps-10 pe-10 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-soft)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
          value={isOpen ? query : selected ? t(selected.labelKey) : ""}
          placeholder={t("accounts.form.selectPlaceholder")}
          onFocus={() => {
            setQuery("")
            setIsOpen(true)
          }}
          onChange={(event) => {
            setQuery(event.target.value)
            setIsOpen(true)
            if (value) onChange("")
          }}
        />
        <ChevronDown className="pointer-events-none absolute end-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
      {isOpen ? (
        <div
          id={`${id}-options`}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-lg"
        >
          {visibleOptions.length ? visibleOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-start text-sm transition-colors ${option.value === value ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)]" : "hover:bg-[var(--color-surface-muted)]"}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option.value)
                setQuery("")
                setIsOpen(false)
              }}
            >
              <span>{t(option.labelKey)}</span>
              {option.value === value ? <Check size={16} className="shrink-0" /> : null}
            </button>
          )) : (
            <p className="px-3 py-2 text-sm text-muted-foreground">{t("accounts.form.industry.noMatches")}</p>
          )}
        </div>
      ) : null}
    </div>
  )
}
