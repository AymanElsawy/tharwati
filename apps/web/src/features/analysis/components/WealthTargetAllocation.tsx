import { Dialog } from "@base-ui/react/dialog"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Info,
  Pencil,
  RefreshCw,
  Scale,
  X,
} from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  calculateWealthTargetComparison,
  getExcludedValuedTargetClasses,
  summarizeWealthTargetInputs,
  summarizeWealthToleranceInput,
  type WealthTargetDriftRow,
} from "@/features/analysis/domain/wealth-target-allocation"
import { useWealthAllocationTargets } from "@/features/analysis/hooks/useWealthAllocationTargets"
import type { WealthAnalysisEvidence } from "@/features/analysis/utils/wealth-analysis"
import {
  formatWealthAnalysisPercent,
  formatWealthAnalysisRoundedAmount,
  normalizeWealthAnalysisDecimalInput,
} from "@/features/analysis/utils/wealth-analysis-formatters"
import type { DashboardAggregate } from "@/features/dashboard/services/dashboard-aggregate.service"
import { useTranslation } from "@/i18n/useTranslation"
import {
  compareDecimals,
  subtractDecimals,
} from "@/lib/financial-calculations/decimal"
import type { Decimal } from "@/lib/supabase/types"

function absoluteDecimal(value: Decimal) {
  return compareDecimals(value, "0") === -1
    ? (subtractDecimals("0", value) ?? value)
    : value
}

function directionalTextClass(status: WealthTargetDriftRow["status"]) {
  if (status === "above") {
    return "text-emerald-700 dark:text-emerald-300"
  }
  if (status === "below") {
    return "text-red-700 dark:text-red-300"
  }
  return "text-amber-700 dark:text-amber-300"
}

function StatusIcon({ status }: { status: WealthTargetDriftRow["status"] }) {
  if (status === "above") {
    return <ArrowUp className="size-4" aria-hidden="true" />
  }
  if (status === "below") {
    return <ArrowDown className="size-4" aria-hidden="true" />
  }
  return <Check className="size-4" aria-hidden="true" />
}

export function WealthTargetAllocation({
  aggregate,
  evidence,
}: {
  aggregate: DashboardAggregate
  evidence: WealthAnalysisEvidence
}) {
  const { language, t } = useTranslation()
  const locale = language === "ar" ? "ar-EG" : "en-US"
  const {
    targets,
    tolerancePercentage,
    isLoading,
    isSaving,
    loadError,
    saveError,
    retry,
    save,
  } = useWealthAllocationTargets()
  const [editorOpen, setEditorOpen] = useState(false)
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [toleranceInput, setToleranceInput] = useState("0")
  const supportedGroups = evidence.assetClasses.map(({ group }) => group)
  const inputSummary = summarizeWealthTargetInputs(inputs, supportedGroups)
  const toleranceSummary = summarizeWealthToleranceInput(toleranceInput)
  const comparison = calculateWealthTargetComparison(
    aggregate,
    evidence,
    targets,
    tolerancePercentage
  )
  const orderedRows = (() => {
    if (comparison.status !== "available") return []
    const rowsByGroup = new Map(
      comparison.rows.map((row) => [row.assetClass.group, row])
    )
    return evidence.assetClasses
      .map(({ group }) => rowsByGroup.get(group))
      .filter((row): row is WealthTargetDriftRow => row !== undefined)
  })()
  const excludedValuedClasses = getExcludedValuedTargetClasses(
    evidence,
    targets
  )
  const excludedClassNames = new Intl.ListFormat(locale, {
    style: "long",
    type: "conjunction",
  }).format(excludedValuedClasses.map(({ labelKey }) => t(labelKey)))

  function openEditor() {
    const saved = new Map(
      targets.map(({ assetClass, percentage }) => [assetClass, percentage])
    )
    setInputs(
      Object.fromEntries(
        supportedGroups.map((group) => [group, saved.get(group) ?? "0"])
      )
    )
    setToleranceInput(tolerancePercentage ?? "0")
    setEditorOpen(true)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (
      !inputSummary.targets ||
      toleranceSummary.tolerancePercentage === null
    ) {
      return
    }
    if (
      await save(inputSummary.targets, toleranceSummary.tolerancePercentage)
    ) {
      setEditorOpen(false)
    }
  }

  function signed(value: Decimal, format: (absolute: Decimal) => string) {
    const comparisonToZero = compareDecimals(value, "0")
    const sign =
      comparisonToZero === 1 ? "+" : comparisonToZero === -1 ? "−" : ""
    return `${sign}${format(absoluteDecimal(value))}`
  }

  const statusLabel = (row: WealthTargetDriftRow) =>
    t(`analysis.targets.status.${row.status}`)

  return (
    <section aria-labelledby="wealth-targets-title">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="tharwati-eyebrow">{t("analysis.targets.eyebrow")}</p>
          <h2 id="wealth-targets-title" className="tharwati-section-title mt-2">
            {t("analysis.targets.title")}
          </h2>
          <p className="tharwati-section-description">
            {t("analysis.targets.description")}
          </p>
          {!isLoading && !loadError ? (
            <p className="mt-2 text-xs font-semibold text-[var(--color-text-secondary)]">
              {t("analysis.targets.tolerance")}{" "}
              <bdi dir="ltr">
                ±{formatWealthAnalysisPercent(tolerancePercentage)}
              </bdi>
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={openEditor}
          disabled={isLoading || loadError}
        >
          <Pencil aria-hidden="true" />
          {t("analysis.targets.edit")}
        </Button>
      </header>

      {isLoading ? (
        <div
          aria-label={t("analysis.targets.loading")}
          className="h-24 animate-pulse rounded-2xl bg-[var(--color-surface-hover)]"
        />
      ) : loadError ? (
        <div className="flex items-start justify-between gap-4 rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 size-5 text-red-700 dark:text-red-300"
              aria-hidden="true"
            />
            <div>
              <h3 className="font-bold">{t("analysis.targets.loadError")}</h3>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {t("analysis.targets.loadErrorDescription")}
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" onClick={() => void retry()}>
            <RefreshCw aria-hidden="true" />
            {t("analysis.targets.retry")}
          </Button>
        </div>
      ) : comparison.status === "not-configured" ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] px-5 py-4 text-sm text-[var(--color-text-secondary)]">
          {t("analysis.targets.empty")}
        </div>
      ) : comparison.status === "unavailable" ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-amber-800 dark:text-amber-300">
          <AlertTriangle
            className="mt-0.5 size-5 shrink-0"
            aria-hidden="true"
          />
          <div>
            <h3 className="font-bold">{t("analysis.targets.unavailable")}</h3>
            <p className="mt-1 text-sm">
              {t("analysis.targets.unavailableDescription")}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {orderedRows.map((row) => (
            <article
              key={row.assetClass.group}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm lg:grid lg:grid-cols-[minmax(10rem,1.15fr)_minmax(6.5rem,0.8fr)_minmax(6.5rem,0.8fr)_minmax(12rem,1.3fr)_minmax(11rem,1fr)] lg:items-center lg:gap-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: row.assetClass.color }}
                  aria-hidden="true"
                />
                <h3 className="truncate font-bold">
                  {t(row.assetClass.labelKey)}
                </h3>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 lg:contents">
                <div>
                  <dt className="text-xs text-[var(--color-text-secondary)]">
                    {t("analysis.targets.current")}
                  </dt>
                  <dd
                    className={`mt-1 font-bold tabular-nums ${directionalTextClass(row.status)}`}
                    dir="ltr"
                  >
                    {formatWealthAnalysisPercent(row.currentPercentage)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--color-text-secondary)]">
                    {t("analysis.targets.target")}
                  </dt>
                  <dd className="mt-1 font-bold tabular-nums" dir="ltr">
                    {formatWealthAnalysisPercent(row.targetPercentage)}
                  </dd>
                </div>
                <div className="col-span-2 lg:col-span-1">
                  <dt className="text-xs text-[var(--color-text-secondary)]">
                    {t("analysis.targets.gap")}
                  </dt>
                  <dd
                    className={`mt-1 text-sm font-bold tabular-nums ${directionalTextClass(row.status)}`}
                    dir="ltr"
                  >
                    {signed(row.gapPercentage, (value) =>
                      formatWealthAnalysisPercent(value)
                    )}
                    <span aria-hidden="true"> · </span>
                    {signed(row.monetaryGap, (value) =>
                      formatWealthAnalysisRoundedAmount(
                        value,
                        aggregate.baseCurrencyCode
                      )
                    )}
                  </dd>
                </div>
                <div className="col-span-2 lg:col-span-1">
                  <dt className="text-xs text-[var(--color-text-secondary)]">
                    {t("analysis.targets.statusLabel")}
                  </dt>
                  <dd
                    className={`mt-1 flex items-center gap-1.5 text-sm font-bold ${directionalTextClass(row.status)}`}
                  >
                    <StatusIcon status={row.status} />
                    {statusLabel(row)}
                  </dd>
                </div>
              </dl>
            </article>
          ))}

          {comparison.largestDeviation ? (
            <aside className="flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3 text-sm">
              <Scale
                className={`mt-0.5 size-4 shrink-0 ${directionalTextClass(comparison.largestDeviation.status)}`}
                aria-hidden="true"
              />
              <p className="text-[var(--color-text-secondary)]">
                <strong
                  className={directionalTextClass(
                    comparison.largestDeviation.status
                  )}
                >
                  {t(comparison.largestDeviation.assetClass.labelKey)}
                </strong>{" "}
                {t("analysis.targets.largestPrefix")}{" "}
                <bdi
                  dir="ltr"
                  className={directionalTextClass(
                    comparison.largestDeviation.status
                  )}
                >
                  {formatWealthAnalysisPercent(
                    absoluteDecimal(comparison.largestDeviation.gapPercentage)
                  )}
                </bdi>{" "}
                <span
                  className={directionalTextClass(
                    comparison.largestDeviation.status
                  )}
                >
                  {t(
                    comparison.largestDeviation.status === "above"
                      ? "analysis.targets.largestAboveTarget"
                      : "analysis.targets.largestBelowTarget"
                  )}
                </span>
                {", "}
                {t("analysis.targets.largestEquivalent")}{" "}
                <bdi
                  dir="ltr"
                  className={directionalTextClass(
                    comparison.largestDeviation.status
                  )}
                >
                  {formatWealthAnalysisRoundedAmount(
                    absoluteDecimal(comparison.largestDeviation.monetaryGap),
                    aggregate.baseCurrencyCode
                  )}
                </bdi>
              </p>
            </aside>
          ) : (
            <aside className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
              <Check
                className="size-4 shrink-0 text-amber-700 dark:text-amber-300"
                aria-hidden="true"
              />
              <p>{t("analysis.targets.allWithin")}</p>
            </aside>
          )}
        </div>
      )}

      {!isLoading &&
      !loadError &&
      targets.length > 0 &&
      excludedValuedClasses.length > 0 ? (
        <aside className="mt-3 flex items-start gap-3 rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
          <Info
            className="mt-0.5 size-4 shrink-0 text-[var(--color-primary)]"
            aria-hidden="true"
          />
          <p>
            {t(
              excludedValuedClasses.length === 1
                ? "analysis.targets.excludedValueSingle"
                : "analysis.targets.excludedValueMultiple",
              { classes: excludedClassNames }
            )}
          </p>
        </aside>
      ) : null}

      <Dialog.Root
        open={editorOpen}
        onOpenChange={(open) => {
          if (!isSaving) setEditorOpen(open)
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-[90] bg-black/60" />
          <Dialog.Popup className="fixed inset-x-3 top-1/2 z-[100] mx-auto max-h-[calc(100dvh-2rem)] w-auto max-w-lg -translate-y-1/2 overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-start shadow-2xl sm:inset-x-0 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Dialog.Title className="text-xl font-bold">
                  {t("analysis.targets.editorTitle")}
                </Dialog.Title>
                <Dialog.Description className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                  {t("analysis.targets.editorDescription")}
                </Dialog.Description>
              </div>
              <Dialog.Close
                disabled={isSaving}
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("common.close")}
                  />
                }
              >
                <X aria-hidden="true" />
              </Dialog.Close>
            </div>
            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => void submit(event)}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {evidence.assetClasses.map((assetClass) => (
                  <label
                    key={assetClass.group}
                    className="block text-sm font-semibold"
                  >
                    {t(assetClass.labelKey)}
                    <span className="relative mt-1.5 block" dir="ltr">
                      <input
                        required
                        type="text"
                        inputMode="decimal"
                        dir="ltr"
                        value={inputs[assetClass.group] ?? ""}
                        lang="en"
                        onChange={(event) =>
                          setInputs({
                            ...inputs,
                            [assetClass.group]:
                              normalizeWealthAnalysisDecimalInput(
                                event.target.value
                              ),
                          })
                        }
                        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 ps-3.5 pe-9 tabular-nums"
                      />
                      <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-sm text-[var(--color-text-secondary)]">
                        %
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-xs leading-5 text-[var(--color-text-secondary)]">
                {t("analysis.targets.zeroExclusion")}
              </p>

              <label className="block text-sm font-semibold">
                {t("analysis.targets.tolerance")}
                <span className="relative mt-1.5 block max-w-44" dir="ltr">
                  <input
                    type="text"
                    inputMode="decimal"
                    dir="ltr"
                    value={toleranceInput}
                    lang="en"
                    onChange={(event) =>
                      setToleranceInput(
                        normalizeWealthAnalysisDecimalInput(event.target.value)
                      )
                    }
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 ps-3.5 pe-9 tabular-nums"
                  />
                  <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-sm text-[var(--color-text-secondary)]">
                    %
                  </span>
                </span>
              </label>
              {toleranceSummary.tolerancePercentage === "0" ? (
                <p className="text-xs leading-5 text-[var(--color-text-secondary)]">
                  {t("analysis.targets.toleranceZeroHelper")}
                </p>
              ) : toleranceSummary.tolerancePercentage !== null ? (
                <p className="text-xs leading-5 text-[var(--color-text-secondary)]">
                  {t("analysis.targets.toleranceHelperPrefix")}{" "}
                  <bdi dir="ltr">
                    ±
                    {formatWealthAnalysisPercent(
                      toleranceSummary.tolerancePercentage
                    )}
                  </bdi>{" "}
                  {t("analysis.targets.toleranceHelperSuffix")}
                </p>
              ) : null}
              {toleranceInput.length > 0 && !toleranceSummary.isValid ? (
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {t("analysis.targets.toleranceError")}
                </p>
              ) : null}

              <div className="flex items-center justify-between rounded-xl bg-[var(--color-surface-muted)] px-4 py-3">
                <span className="text-sm font-semibold">
                  {t("analysis.targets.total")}
                </span>
                <strong className="tabular-nums" dir="ltr">
                  {formatWealthAnalysisPercent(inputSummary.total)} / 100%
                </strong>
              </div>
              {!inputSummary.isValid ? (
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {t("analysis.targets.totalError")}
                </p>
              ) : null}
              {saveError ? (
                <p
                  role="alert"
                  className="text-sm text-red-700 dark:text-red-300"
                >
                  {t("analysis.targets.saveError")}
                </p>
              ) : null}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving}
                  onClick={() => setEditorOpen(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={
                    !inputSummary.isValid ||
                    !toleranceSummary.isValid ||
                    isSaving
                  }
                >
                  {isSaving
                    ? t("analysis.targets.saving")
                    : t("analysis.targets.save")}
                </Button>
              </div>
            </form>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  )
}
