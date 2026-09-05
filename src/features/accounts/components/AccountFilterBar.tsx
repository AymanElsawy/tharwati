import {
  accountTypeOptions,
  type AccountTypeCode,
} from "@/features/accounts/types/account-form"
import { useTranslation } from "@/i18n/useTranslation"
import { Search } from "lucide-react"

export type AccountFilters = {
  search: string
  type: AccountTypeCode | null
  currency: string | null
  showArchived: boolean
}

type Update = <Key extends keyof AccountFilters>(
  key: Key,
  value: AccountFilters[Key]
) => void

export function AccountFilterBar({
  filters,
  currencies,
  resultCount,
  onChange,
}: {
  filters: AccountFilters
  currencies: string[]
  resultCount: number
  onChange: Update
}) {
  const { t } = useTranslation()
  const input =
    "h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 text-sm text-[var(--color-text-primary)] shadow-sm outline-none transition placeholder:text-muted-foreground/80 hover:border-[var(--border-subtle)] focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary-soft)]"
  return (
    <div className="mt-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--color-surface-muted)]/55 p-3 shadow-[0_8px_24px_rgba(15,23,42,0.035)] sm:p-4">
      <div className="grid items-center gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1fr)_minmax(9rem,auto)_minmax(9rem,auto)_auto_auto]">
        <div className="relative min-w-0">
          <Search
            aria-hidden="true"
            size={17}
            className="pointer-events-none absolute inset-y-0 start-3 my-auto text-muted-foreground"
          />
          <input
            aria-label={t("accounts.filters.search")}
            placeholder={t("accounts.filters.searchPlaceholder")}
            value={filters.search}
            onChange={(event) => onChange("search", event.target.value)}
            className={`${input} ps-10`}
          />
        </div>
        <select
          aria-label={t("accounts.filters.type")}
          value={filters.type ?? ""}
          onChange={(event) =>
            onChange(
              "type",
              (event.target.value || null) as AccountTypeCode | null
            )
          }
          className={input}
        >
          <option value="">{t("accounts.filters.allTypes")}</option>
          {accountTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.labelKey)}
            </option>
          ))}
        </select>
        <select
          aria-label={t("accounts.filters.currency")}
          value={filters.currency ?? ""}
          onChange={(event) => onChange("currency", event.target.value || null)}
          className={input}
        >
          <option value="">{t("accounts.filters.allCurrencies")}</option>
          {currencies.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <div className="flex h-11 items-center justify-between gap-3 sm:col-span-2 lg:contents">
          <label className="flex min-w-0 items-center gap-2 rounded-xl border border-transparent px-2 text-sm font-medium text-[var(--color-text-primary)] transition hover:bg-[var(--color-surface-hover)]">
            <input
              type="checkbox"
              checked={filters.showArchived}
              onChange={(event) =>
                onChange("showArchived", event.target.checked)
              }
            />
            {t("accounts.filters.showArchived")}
          </label>
          <span className="shrink-0 px-2 text-xs font-medium whitespace-nowrap text-muted-foreground lg:self-center lg:justify-self-end">
            {t("accounts.filters.results", { count: resultCount })}
          </span>
        </div>
      </div>
    </div>
  )
}
