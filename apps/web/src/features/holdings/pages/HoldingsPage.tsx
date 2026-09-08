import { AlertCircle, Layers3, RefreshCw, Search } from "lucide-react"
import { useMemo, useState } from "react"

import { useTranslation } from "../../../i18n/useTranslation"
import { assetTypeOptions } from "../../assets/types/asset-form"
import { EmptyHoldingsState } from "../components/EmptyHoldingsState"
import { HoldingTable } from "../components/HoldingTable"
import { PortfolioSummary } from "../components/PortfolioSummary"
import { useHoldings } from "../hooks/useHoldings"
import {
  createOpenHoldingViews,
  createPortfolioCostBasisSummary,
} from "../types/holding-view"

export function HoldingsPage() {
  const { t } = useTranslation()
  const { error, holdings, isLoading, refresh } = useHoldings()
  const [search, setSearch] = useState("")
  const [accountId, setAccountId] = useState("")
  const [assetType, setAssetType] = useState("")
  const openHoldings = useMemo(
    () => createOpenHoldingViews(holdings),
    [holdings],
  )
  const portfolioTotals = useMemo(
    () => createPortfolioCostBasisSummary(holdings),
    [holdings],
  )

  const accounts = useMemo(
    () =>
      [
        ...new Map(
          openHoldings.map(({ holding }) => [
            holding.account.id,
            holding.account,
          ]),
        ).values(),
      ].sort((left, right) => left.name.localeCompare(right.name)),
    [openHoldings],
  )
  const filteredHoldings = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return openHoldings.filter(
      ({ holding }) =>
        (!query ||
          holding.asset.name.toLocaleLowerCase().includes(query) ||
          holding.asset.symbol?.toLocaleLowerCase().includes(query)) &&
        (!accountId || holding.account.id === accountId) &&
        (!assetType || holding.asset.asset_type_code === assetType),
    )
  }, [accountId, assetType, openHoldings, search])

  return (
    <section className="mx-auto max-w-7xl">
      <header className="mb-8">
        <div className="flex items-center gap-3 text-[var(--color-primary)]">
          <Layers3 size={26} />
          <span className="text-sm font-bold uppercase tracking-[0.18em]">
            {t("holdings.page.eyebrow")}
          </span>
        </div>
        <h1 className="mt-3 text-3xl font-black">
          {t("holdings.page.title")}
        </h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          {t("holdings.page.description")}
        </p>
      </header>

      {isLoading ? (
        <div className="space-y-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="h-14 animate-pulse rounded-xl bg-[var(--color-surface-hover)]"
            />
          ))}
        </div>
      ) : null}

      {!isLoading && error ? (
        <div
          role="alert"
          className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50 p-8 text-center"
        >
          <AlertCircle size={34} className="text-red-600" />
          <h2 className="mt-4 text-xl font-bold text-red-900">
            {t("holdings.error.title")}
          </h2>
          <p className="mt-2 text-sm text-red-700">{error.message}</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-5 flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-white"
          >
            <RefreshCw size={16} />
            {t("holdings.actions.tryAgain")}
          </button>
        </div>
      ) : null}

      {!isLoading && !error && openHoldings.length === 0 ? (
        <EmptyHoldingsState />
      ) : null}

      {!isLoading && !error && openHoldings.length > 0 ? (
        <>
          <PortfolioSummary totals={portfolioTotals} />
          <div className="mb-4 grid gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:grid-cols-[minmax(220px,1fr)_220px_220px]">
            <label className="relative">
              <Search
                size={17}
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]"
              />
              <span className="sr-only">{t("holdings.filters.search")}</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("holdings.filters.searchPlaceholder")}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] py-2.5 pe-3 ps-10 text-sm"
              />
            </label>
            <select
              aria-label={t("holdings.filters.account")}
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2.5 text-sm"
            >
              <option value="">{t("holdings.filters.allAccounts")}</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
            <select
              aria-label={t("holdings.filters.assetType")}
              value={assetType}
              onChange={(event) => setAssetType(event.target.value)}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2.5 text-sm"
            >
              <option value="">{t("holdings.filters.allTypes")}</option>
              {assetTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </div>
          {filteredHoldings.length > 0 ? (
            <HoldingTable holdings={filteredHoldings} />
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center text-[var(--color-text-secondary)]">
              {t("holdings.filters.noResults")}
            </div>
          )}
        </>
      ) : null}
    </section>
  )
}
