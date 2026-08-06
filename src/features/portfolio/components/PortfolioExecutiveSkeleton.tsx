import { useTranslation } from "@/i18n/useTranslation"

export function PortfolioExecutiveSkeleton() {
  const { t } = useTranslation()
  const pulse =
    "animate-pulse bg-[var(--color-surface-hover)] motion-reduce:animate-none"
  return (
    <div
      className="grid gap-8"
      aria-label={t("common.loading")}
      aria-busy="true"
    >
      <div className="flex items-end justify-between border-b border-[var(--color-border)]/60 pb-7">
        <div>
          <div className={`h-3 w-28 rounded ${pulse}`} />
          <div className={`mt-3 h-10 w-52 rounded ${pulse}`} />
          <div className={`mt-3 h-4 w-80 max-w-full rounded ${pulse}`} />
        </div>
        <div className={`hidden h-10 w-56 rounded-xl sm:block ${pulse}`} />
      </div>
      <div className={`h-72 rounded-2xl ${pulse}`} />
      <div className={`h-64 rounded-2xl ${pulse}`} />
      <div className="grid gap-5 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className={`h-52 rounded-xl ${pulse}`}
          />
        ))}
      </div>
      <div className={`h-44 rounded-xl ${pulse}`} />
      {Array.from({ length: 3 }, (_, index) => (
        <div key={`evidence-${index}`} className="border-t border-[var(--border-subtle)] pt-8">
          <div className={`h-3 w-28 rounded ${pulse}`} />
          <div className={`mt-3 h-7 w-64 max-w-full rounded ${pulse}`} />
          <div className={`mt-7 h-40 w-full rounded ${pulse}`} />
        </div>
      ))}
    </div>
  )
}
