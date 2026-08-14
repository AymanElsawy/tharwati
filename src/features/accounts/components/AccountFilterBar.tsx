import { accountTypeOptions, type AccountTypeCode } from "@/features/accounts/types/account-form"
import { useTranslation } from "@/i18n/useTranslation"

export type AccountFilters = {
  search: string
  type: AccountTypeCode | null
  currency: string | null
  status: "all" | "active" | "archived"
}

type Update = <Key extends keyof AccountFilters>(key: Key, value: AccountFilters[Key]) => void

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
    "h-10 rounded-lg border border-[var(--border-subtle)] bg-background px-3 text-sm focus-visible:ring-2"
  return (
    <div className="mt-6 grid gap-3 border-y border-[var(--border-subtle)] py-4 sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1fr)_repeat(3,auto)_auto]">
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
        onChange={(event) => onChange("type", (event.target.value || null) as AccountTypeCode | null)}
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
      <select
        aria-label={t("accounts.filters.status")}
        value={filters.status}
        onChange={(event) => onChange("status", event.target.value as AccountFilters["status"])}
        className={input}
      >
        <option value="all">{t("accounts.filters.allStatuses")}</option>
        <option value="active">{t("accounts.card.active")}</option>
        <option value="archived">{t("accounts.card.archived")}</option>
      </select>
      <span className="self-center text-xs text-muted-foreground">
        {t("accounts.filters.results", { count: resultCount })}
      </span>
    </div>
  )
}
