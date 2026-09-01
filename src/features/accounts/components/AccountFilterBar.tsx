import {
  accountTypeOptions,
  type AccountTypeCode,
} from "@/features/accounts/types/account-form"
import { useTranslation } from "@/i18n/useTranslation"

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
    "h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)] outline-none transition focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary-soft)] sm:h-10"
  return (
    <div className="mt-6 grid gap-3 py-4 sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1fr)_repeat(2,auto)_auto_auto]">
      <input
        aria-label={t("accounts.filters.search")}
        placeholder={t("accounts.filters.searchPlaceholder")}
        value={filters.search}
        onChange={(event) => onChange("search", event.target.value)}
        className={input}
      />
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
      <label className="flex h-11 items-center gap-2 px-1 text-sm text-[var(--color-text-primary)] sm:h-10">
        <input
          type="checkbox"
          checked={filters.showArchived}
          onChange={(event) => onChange("showArchived", event.target.checked)}
        />
        {t("accounts.filters.showArchived")}
      </label>
      <span className="self-center text-xs text-muted-foreground">
        {t("accounts.filters.results", { count: resultCount })}
      </span>
    </div>
  )
}
