import { BriefcaseBusiness, FilePlus2 } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import type { AssetInventoryItem } from "@/features/assets/types/asset-workspace"
import { useTranslation } from "@/i18n/useTranslation"

type Props = {
  open: boolean
  records: AssetInventoryItem[]
  scopeName: string
  onClose: () => void
  onCreateRecord: () => void
  onRecordInvestment: () => void
  onSelectExisting: (id: string) => void
}

export function AssetIntentDialog({
  open,
  records,
  scopeName,
  onClose,
  onCreateRecord,
  onRecordInvestment,
  onSelectExisting,
}: Props) {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  if (!open) return null

  const query = search.trim().toLocaleLowerCase()
  const matches = query
    ? records
        .filter((item) =>
          `${item.asset.name} ${item.asset.symbol ?? ""}`
            .toLocaleLowerCase()
            .includes(query),
        )
        .slice(0, 5)
    : []

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/55 p-4 sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-intent-title"
        aria-describedby="asset-intent-description"
        className="my-auto flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--color-background)] text-start"
      >
        <header className="shrink-0 px-6 pt-6 sm:px-7 sm:pt-7">
          <h2 id="asset-intent-title" className="text-xl font-semibold">
            {t("assets.intent.title")}
          </h2>
          <p
            id="asset-intent-description"
            className="mt-2 max-w-md text-sm leading-6 text-muted-foreground"
          >
            {t("assets.intent.description")}
          </p>
        </header>

        <div className="min-h-0 space-y-6 overflow-y-auto px-6 py-6 sm:px-7">
          <div>
            <label htmlFor="asset-intent-search" className="block text-sm font-medium">
              {t("assets.intent.search")}
            </label>
            <input
              id="asset-intent-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="mt-2 h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--color-surface)] px-3 outline-none focus-visible:ring-2"
            />
            {matches.length > 0 ? (
              <ul className="mt-2 divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
                {matches.map((item) => (
                  <li key={item.asset.id}>
                    <button
                      type="button"
                      onClick={() => onSelectExisting(item.asset.id)}
                      className="w-full py-3 text-start outline-none focus-visible:ring-2"
                    >
                      <strong>{item.asset.name}</strong>
                      <span className="ms-2 text-xs text-muted-foreground">
                        {item.asset.symbol}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="border-y border-[var(--border-subtle)] py-3">
            <span className="block text-xs font-medium text-muted-foreground">
              {t("assets.workspace.scope")}
            </span>
            <strong className="mt-1 block text-sm font-medium">{scopeName}</strong>
          </div>

          <div className="grid items-stretch gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onCreateRecord}
              className="flex min-h-40 flex-col rounded-xl border border-[var(--border-subtle)] p-5 text-start outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 motion-reduce:transition-none"
            >
              <FilePlus2 aria-hidden="true" />
              <strong className="mt-4 block">{t("assets.intent.record")}</strong>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {t("assets.intent.recordDescription")}
              </span>
            </button>
            <button
              type="button"
              onClick={onRecordInvestment}
              className="flex min-h-40 flex-col rounded-xl border border-[var(--border-subtle)] p-5 text-start outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 motion-reduce:transition-none"
            >
              <BriefcaseBusiness aria-hidden="true" />
              <strong className="mt-4 block">{t("assets.intent.investment")}</strong>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {t("assets.intent.investmentDescription")}
              </span>
            </button>
          </div>
        </div>

        <footer className="flex shrink-0 justify-end border-t border-[var(--border-subtle)] px-6 py-4 sm:px-7">
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
        </footer>
      </section>
    </div>
  )
}
