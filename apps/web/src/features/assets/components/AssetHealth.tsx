import { AlertTriangle, CheckCircle2, CircleOff } from "lucide-react"

import type {
  AssetHealthAnalysis,
  AssetHealthFactorId,
} from "@/features/assets/types/asset-workspace"
import { useTranslation } from "@/i18n/useTranslation"

export function AssetHealth({
  analysis,
  selectedFactorId,
  onSelect,
}: {
  analysis: AssetHealthAnalysis
  selectedFactorId: AssetHealthFactorId | null
  onSelect: (id: AssetHealthFactorId | null) => void
}) {
  const { t } = useTranslation()
  const selected = analysis.factors.find(
    (factor) => factor.id === selectedFactorId,
  )
  return (
    <section
      aria-labelledby="asset-health-title"
      className="mt-16 border-t border-[var(--border-subtle)] pt-10"
    >
      <header className="tharwati-section-header">
        <p className="tharwati-eyebrow">{t("assets.health.eyebrow")}</p>
        <h2 id="asset-health-title" className="tharwati-section-title mt-2">
          {t("assets.health.title")}
        </h2>
        <p className="tharwati-section-description">
          {t("assets.health.description")}
        </p>
      </header>

      <div className="mt-7 grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {t("assets.health.overall")}
          </p>
          <p className="mt-3 font-heading text-5xl tabular-nums">
            {analysis.score === null ? "—" : `${analysis.score}%`}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            {analysis.score === null
              ? t("assets.health.unavailable")
              : analysis.provisional
                ? t("assets.health.provisional")
                : t("assets.health.complete")}
          </p>
        </div>
        <div className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
          {analysis.factors.map((factor) => {
            const Icon =
              factor.status === "complete"
                ? CheckCircle2
                : factor.status === "attention"
                  ? AlertTriangle
                  : CircleOff
            return (
              <button
                key={factor.id}
                type="button"
                aria-pressed={selectedFactorId === factor.id}
                onClick={() =>
                  onSelect(selectedFactorId === factor.id ? null : factor.id)
                }
                className="grid w-full grid-cols-[1fr_auto] gap-4 px-2 py-4 text-start outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 aria-pressed:bg-muted/50 motion-reduce:transition-none"
              >
                <span className="flex min-w-0 items-start gap-3">
                  <Icon
                    size={17}
                    className={
                      factor.status === "attention"
                        ? "mt-0.5 text-amber-700 dark:text-amber-300"
                        : "mt-0.5 text-muted-foreground"
                    }
                    aria-hidden="true"
                  />
                  <span>
                    <strong className="block text-sm font-semibold">
                      {t(`assets.health.factor.${factor.id}`)}
                    </strong>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {factor.status === "unavailable"
                        ? t("assets.health.factorUnavailable")
                        : t("assets.health.coverage", {
                            numerator: factor.numerator,
                            denominator: factor.denominator,
                          })}
                    </span>
                  </span>
                </span>
                <span className="tabular-nums text-sm font-semibold">
                  {factor.score === null ? "—" : `${factor.score}%`}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {selected ? (
        <div
          role="status"
          className="mt-5 border-s-2 border-primary ps-4 text-sm text-muted-foreground"
        >
          <strong className="block text-foreground">
            {t(`assets.health.factor.${selected.id}`)}
          </strong>
          <p className="mt-1">{t(`assets.health.explanation.${selected.id}`)}</p>
        </div>
      ) : null}
    </section>
  )
}
