import { AlertCircle, Box, RefreshCw } from "lucide-react"

import { useTranslation } from "@/i18n/useTranslation"

export function AssetWorkspaceSkeleton() {
  const { t } = useTranslation()
  const pulse = "animate-pulse rounded bg-[var(--color-surface-hover)] motion-reduce:animate-none"
  return <div aria-busy="true" aria-label={t("common.loading")} className="grid gap-7"><div className="border-b pb-7"><div className={`h-3 w-28 ${pulse}`} /><div className={`mt-3 h-10 w-48 ${pulse}`} /><div className={`mt-3 h-4 w-96 max-w-full ${pulse}`} /></div><div className={`h-12 w-full ${pulse}`} /><div className={`h-10 w-full ${pulse}`} /><div className="space-y-3">{Array.from({ length: 7 }, (_, index) => <div key={index} className={`h-14 w-full ${pulse}`} />)}</div></div>
}

export function AssetWorkspaceError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const { t } = useTranslation()
  return <div role="alert" className="border-y border-destructive/30 py-14 text-center"><AlertCircle className="mx-auto text-destructive" size={30} /><h1 className="mt-4 font-heading text-2xl">{t("assets.error.loadTitle")}</h1><p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">{error.message}</p><button type="button" onClick={onRetry} className="tharwati-button-primary mt-5 inline-flex gap-2"><RefreshCw size={15} />{t("assets.actions.tryAgain")}</button></div>
}

export function AssetWorkspaceEmpty({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  const { t } = useTranslation()
  return <div className="border-y border-[var(--border-subtle)] py-14 text-center"><Box className="mx-auto text-muted-foreground" size={30} /><h2 className="mt-4 font-heading text-xl">{filtered ? t("assets.filters.noResults") : t("assets.empty.title")}</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{filtered ? t("assets.workspace.emptyFiltered") : t("assets.empty.description")}</p>{filtered ? <button type="button" onClick={onClear} className="mt-4 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:ring-2">{t("assets.workspace.clearFilters")}</button> : <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("tharwati:add-investment"))} className="tharwati-button-primary mt-5">{t("investment.primaryAction")}</button>}</div>
}
