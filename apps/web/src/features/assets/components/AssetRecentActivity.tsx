import type { AssetActivityEvidence } from "@/features/assets/types/asset-workspace"
import { formatPortfolioAmount } from "@/features/portfolio/utils/portfolio-formatters"
import { useTranslation } from "@/i18n/useTranslation"

export function AssetRecentActivity({
  activity,
  error,
  accountId,
  activityType,
  accounts,
  types,
  onAccountFilter,
  onTypeFilter,
  onOpen,
}: {
  activity: AssetActivityEvidence[]
  error: string | null
  accountId: string | null
  activityType: string | null
  accounts: Array<{ id: string; name: string }>
  types: string[]
  onAccountFilter: (value: string | null) => void
  onTypeFilter: (value: string | null) => void
  onOpen: (id: string) => void
}) {
  const { t, language } = useTranslation()
  const locale = language === "ar" ? "ar-SA" : "en-US"
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" })
  return (
    <section aria-labelledby="asset-activity-title" className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="tharwati-eyebrow">{t("assets.activity.eyebrow")}</p>
          <h2 id="asset-activity-title" className="tharwati-section-title mt-2">
            {t("assets.activity.title")}
          </h2>
          <p className="text-muted-foreground mt-2 text-sm">
            {t("assets.activity.description")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label={t("assets.activity.filterType")}
            value={activityType ?? ""}
            onChange={(event) => onTypeFilter(event.target.value || null)}
            className="bg-background rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
          >
            <option value="">{t("assets.activity.allTypes")}</option>
            {types.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <select
            aria-label={t("assets.activity.filterAccount")}
            value={accountId ?? ""}
            onChange={(event) => onAccountFilter(event.target.value || null)}
            className="bg-background rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
          >
            <option value="">{t("holdings.filters.allAccounts")}</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error ? (
        <div role="alert" className="mt-6 border-y border-red-500/30 py-7 text-sm text-red-700 dark:text-red-300">
          <strong className="block">{t("assets.activity.unavailable")}</strong>
          <span className="mt-1 block text-xs">{error}</span>
        </div>
      ) : activity.length === 0 ? (
        <p className="text-muted-foreground mt-6 border-y border-[var(--border-subtle)] py-7 text-sm">
          {t("assets.activity.empty")}
        </p>
      ) : (
        <ol className="mt-5 divide-y divide-[var(--border-subtle)]">
          {activity.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onOpen(item.id)}
                className="grid w-full gap-2 py-4 text-start focus-visible:ring-2 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-4"
              >
                <time
                  className="text-muted-foreground text-xs"
                  dateTime={item.occurredAt}
                >
                  {date.format(new Date(item.occurredAt))}
                </time>
                <span className="min-w-0">
                  <strong className="block truncate font-medium">
                    {item.description}
                  </strong>
                  <span className="text-muted-foreground mt-1 block truncate text-xs">
                    {item.type} ·{" "}
                    {item.entries.map((entry) => entry.assetName).join(", ")}
                  </span>
                </span>
                <span className="tabular-nums" dir="ltr">
                  {formatPortfolioAmount(
                    item.originalAmount,
                    item.originalCurrency,
                    locale
                  )}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
