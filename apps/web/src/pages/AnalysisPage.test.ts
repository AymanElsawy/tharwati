import { describe, expect, it } from "vitest"

import { ar } from "@/i18n/ar/translations"
import { en } from "@/i18n/en/translations"
import componentSource from "./AnalysisPage.tsx?raw"
import healthSource from "@/features/analysis/components/WealthHealthHero.tsx?raw"
import allocationSource from "@/features/analysis/components/WealthAllocationAnalysis.tsx?raw"
import attentionSource from "@/features/analysis/components/WealthAttentionSummary.tsx?raw"
import targetsSource from "@/features/analysis/components/WealthTargetAllocation.tsx?raw"

describe("AnalysisPage", () => {
  it("loads the shared Dashboard valuation into localized P0 states", () => {
    expect(componentSource).toContain("useDashboardAggregate()")
    expect(componentSource).toContain('t("analysis.loading")')
    expect(componentSource).toContain('t("analysis.error.retry")')
    expect(componentSource).toContain("result.accountCount === 0")
    expect(componentSource).toContain('t("pages.analysis.title")')
    expect(componentSource).toContain('t("pages.analysis.description")')
    expect(en["pages.analysis.title"]).toBe("Wealth Analysis")
    expect(ar["pages.analysis.title"]).toBe("تحليل الثروة")
  })

  it("renders only the four approved V1 sections in product order", () => {
    expect(componentSource.indexOf("<WealthHealthHero")).toBeLessThan(
      componentSource.indexOf("<WealthAttentionSummary")
    )
    expect(componentSource.indexOf("<WealthAttentionSummary")).toBeLessThan(
      componentSource.indexOf("<WealthAllocationAnalysis")
    )
    expect(componentSource.indexOf("<WealthAllocationAnalysis")).toBeLessThan(
      componentSource.indexOf("<WealthTargetAllocation")
    )
    expect(componentSource).not.toContain("<WealthKeyInsights")
    expect(componentSource).not.toContain("<WealthAnalysisDimensions")
    expect(componentSource).not.toContain("<WealthValuationQuality")
    expect(componentSource).not.toContain("<WealthExplorer")
    expect(componentSource).not.toContain("AssetsBreakdownCard")
    expect(componentSource).not.toContain("WealthSummary")
    expect(componentSource).toContain('className="grid gap-8 lg:gap-10"')
  })

  it("keeps Wealth Health as a synthesis with secondary net wealth", () => {
    expect(healthSource).toContain('t("analysis.health.title")')
    expect(healthSource).toContain("analysis.health.synthesis.incomplete")
    expect(healthSource).toContain("analysis.health.synthesis.stale")
    expect(healthSource).toContain("analysis.health.synthesis.current")
    expect(healthSource).not.toContain("healthState")
    expect(healthSource).not.toContain("score")
    expect(healthSource).not.toContain("largestExposure")
    expect(healthSource).not.toContain("evidenceItems")
    expect(healthSource).not.toContain("analysis.health.cashExposure")
    expect(healthSource).not.toContain("analysis.health.liabilities")
    expect(healthSource).toContain('dir="ltr"')
    expect(healthSource).toContain("text-base font-bold tabular-nums")
    expect(en["analysis.health.synthesis.incomplete"]).toContain("limited")
    expect(ar["analysis.health.synthesis.incomplete"]).toContain("محدودة")
  })

  it("shows the approved donut allocation with honest coverage copy", () => {
    expect(allocationSource).toContain(
      "const allocated = evidence.assetClasses"
    )
    expect(allocationSource).toContain(
      ".filter(({ percentage }) => percentage !== null)"
    )
    expect(allocationSource).toContain("<ResponsiveContainer")
    expect(allocationSource).toContain("<PieChart>")
    expect(allocationSource).toContain('dataKey="chartValue"')
    expect(allocationSource).toContain('t("analysis.allocation.valuedTotal")')
    expect(allocationSource).toContain(
      't("analysis.allocation.completeCoverage")'
    )
    expect(allocationSource).toContain('t("analysis.allocation.legendLabel")')
    expect(allocationSource).toContain('<bdi dir="ltr">')
    expect(en["analysis.allocation.completeCoverage"]).toBe(
      "100% of included allocation"
    )
    expect(ar["analysis.allocation.completeCoverage"]).toBe(
      "100% من التوزيع المشمول"
    )
  })

  it("presents the largest exposure only as Allocation context", () => {
    expect(allocationSource).toContain("evidence.largestExposure")
    expect(healthSource).not.toContain("Largest exposure")
  })

  it("limits attention to stale or incomplete valuation observations", () => {
    expect(attentionSource).toContain('aggregate.status === "incomplete"')
    expect(attentionSource).toContain('aggregate.freshness === "stale"')
    expect(attentionSource).not.toContain("largestExposure")
    expect(attentionSource).toContain('t("analysis.attention.noneTitle")')
    expect(attentionSource).toContain("max-w-2xl items-center")
    expect(attentionSource).toContain('className="mb-3"')
    expect(en["analysis.attention.eyebrow"]).toBe("Attention")
    expect(ar["analysis.attention.eyebrow"]).toBe("انتباه")
    expect(attentionSource).toContain('t("analysis.attention.title")')
    expect(en["analysis.attention.noneDescription"]).toBe(
      "Current valuation evidence shows no condition requiring attention."
    )
    expect(ar["analysis.attention.noneDescription"]).toContain("لا تظهر")
  })

  it("renders target drift after Wealth Allocation with a responsive editor", () => {
    expect(componentSource).toContain("<WealthTargetAllocation")
    expect(targetsSource).toContain("calculateWealthTargetComparison")
    expect(targetsSource).toContain('t("analysis.targets.edit")')
    expect(targetsSource).toContain("lg:grid-cols-[minmax(10rem,1.15fr)")
    expect(targetsSource).toContain(
      'className="mt-4 grid grid-cols-2 gap-3 lg:contents"'
    )
    expect(targetsSource).toContain('t("analysis.targets.statusLabel")')
    expect(targetsSource).toContain("<StatusIcon status={row.status}")
    expect(targetsSource).toContain("directionalTextClass(row.status)")
    expect(targetsSource).toContain("text-amber-700 dark:text-amber-300")
    expect(targetsSource).toContain("formatWealthAnalysisRoundedAmount")
    expect(targetsSource).toContain("bg-[var(--color-surface-muted)]")
    expect(targetsSource).toContain('dir="ltr"')
    expect(targetsSource).toContain("!toleranceSummary.isValid")
    expect(targetsSource).toContain(
      'setToleranceInput(tolerancePercentage ?? "0")'
    )
    expect(targetsSource).toContain('saved.get(group) ?? "0"')
    expect(targetsSource).toContain('useState("0")')
    expect(targetsSource).not.toContain("tolerance-not-configured")
    expect(targetsSource).toContain('t("analysis.targets.toleranceZeroHelper")')
    expect(targetsSource).toContain("return evidence.assetClasses")
    expect(targetsSource).toContain('t("analysis.targets.tolerance")')
    expect(targetsSource).toContain("±{formatWealthAnalysisPercent")
    expect(targetsSource).toContain(
      'className="relative mt-1.5 block" dir="ltr"'
    )
    expect(targetsSource).toContain('lang="en"')
    expect(targetsSource).toContain("normalizeWealthAnalysisDecimalInput")
    expect(targetsSource).toContain('"analysis.targets.largestAboveTarget"')
    expect(targetsSource).toContain('"analysis.targets.largestBelowTarget"')
    expect(targetsSource).toContain("getExcludedValuedTargetClasses")
    expect(targetsSource).toContain("new Intl.ListFormat")
    expect(targetsSource).toContain("analysis.targets.excludedValueSingle")
    expect(targetsSource).toContain("analysis.targets.excludedValueMultiple")
    expect(targetsSource).toContain('t("analysis.targets.allWithin")')
    expect(targetsSource.indexOf('t("analysis.targets.current")')).toBeLessThan(
      targetsSource.indexOf('t("analysis.targets.target")')
    )
    expect(targetsSource.indexOf('t("analysis.targets.target")')).toBeLessThan(
      targetsSource.indexOf('t("analysis.targets.gap")')
    )
    expect(targetsSource.indexOf('t("analysis.targets.gap")')).toBeLessThan(
      targetsSource.indexOf('t("analysis.targets.statusLabel")')
    )
    expect(en["analysis.targets.title"]).toBe("Target Allocation & Drift")
    expect(ar["analysis.targets.title"]).toBe("التوزيع المستهدف والانحراف")
    expect(en["analysis.targets.status.above"]).toBe("Above target range")
    expect(en["analysis.targets.status.below"]).toBe("Below target range")
    expect(en["analysis.targets.status.within"]).toBe("Within target range")
    expect(en["analysis.targets.toleranceZeroHelper"]).toBe(
      "0% means only an exact match to your target is within range."
    )
    expect(en["analysis.targets.largestBelowTarget"]).toBe(
      "below your selected target"
    )
    expect(ar["analysis.targets.toleranceZeroHelper"]).toContain("0%")
    expect(ar["analysis.targets.largestBelowTarget"]).toContain("هدفك")
    expect(ar["analysis.targets.status.above"]).toBe("أعلى من النطاق المستهدف")
    expect(ar["analysis.targets.status.below"]).toBe("أقل من النطاق المستهدف")
    expect(ar["analysis.targets.status.within"]).toBe("ضمن النطاق المستهدف")
    expect(ar["analysis.targets.excludedValueMultiple"]).toContain(
      "{{classes}}"
    )
    expect(en["analysis.targets.allWithin"]).toContain("within")
  })
})
