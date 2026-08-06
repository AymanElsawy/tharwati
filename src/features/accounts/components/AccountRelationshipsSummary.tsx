import { Landmark, Link2, Target } from "lucide-react"
import type { AccountAnalyticalSnapshot } from "@/features/accounts/types/account-workspace"
import { useTranslation } from "@/i18n/useTranslation"

export function AccountRelationshipsSummary({
  analysis,
  selected,
  onSelect,
}: {
  analysis: AccountAnalyticalSnapshot
  selected: string | null
  onSelect: (id: string | null) => void
}) {
  const { t } = useTranslation()
  const icons = {
    account_type: Landmark,
    linked_holdings: Link2,
    linked_assets: Link2,
    linked_goals: Target,
  }
  return (
    <section
      aria-labelledby="account-relationships-title"
      className="mt-14 border-t border-[var(--border-subtle)] pt-9"
    >
      <header className="tharwati-section-header">
        <p className="tharwati-eyebrow">
          {t("accounts.relationships.eyebrow")}
        </p>
        <h2
          id="account-relationships-title"
          className="tharwati-section-title mt-2"
        >
          {t("accounts.relationships.title")}
        </h2>
        <p className="tharwati-section-description">
          {t("accounts.relationships.description")}
        </p>
      </header>
      <div className="mt-7 grid gap-px border-y border-[var(--border-subtle)] bg-[var(--border-subtle)] sm:grid-cols-2 lg:grid-cols-3">
        {analysis.relationships.map((entry) => {
          const Icon = icons[entry.kind]
          return (
            <button
              key={entry.id}
              type="button"
              disabled={entry.availability === "unavailable"}
              aria-pressed={selected === entry.id}
              onClick={() => onSelect(selected === entry.id ? null : entry.id)}
              className="bg-background hover:bg-muted/30 aria-pressed:bg-muted/50 flex min-h-24 items-center justify-between gap-4 px-5 py-4 text-start focus-visible:z-10 focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-55"
            >
              <span className="flex items-center gap-3">
                <Icon size={17} aria-hidden="true" />
                <span>
                  <strong className="block text-sm">
                    {entry.kind === "account_type"
                      ? entry.label
                      : t(`accounts.relationships.${entry.kind}`)}
                  </strong>
                  <span className="text-muted-foreground mt-1 block text-xs">
                    {entry.availability === "unavailable"
                      ? t("accounts.relationships.unavailable")
                      : t("accounts.relationships.evidence", {
                          count: entry.evidenceIds.length,
                        })}
                  </span>
                </span>
              </span>
              <span className="font-semibold tabular-nums">
                {entry.availability === "unavailable" ? "—" : entry.count}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
