import { describe, expect, it } from "vitest"

import componentSource from "./DashboardGoalsCard.tsx?raw"
import repositorySource from "@/features/goals/repositories/goals.repository.ts?raw"

describe("DashboardGoalsCard", () => {
  it("uses focused active, unarchived, date-ordered goal loading", () => {
    expect(repositorySource).toContain('.eq("status", "active")')
    expect(repositorySource).toContain('.is("archived_at", null)')
    expect(repositorySource).toContain(
      '.order("target_date", { ascending: true, nullsFirst: false })'
    )
    expect(repositorySource).toContain(
      '.order("created_at", { ascending: true })'
    )
    expect(repositorySource).toContain(".limit(limit)")
  })

  it("keeps currencies separate and caps only visual progress", () => {
    expect(componentSource).toContain("goal.currency_code")
    expect(componentSource).toContain("goal.progressPercent")
    expect(componentSource).toContain("value={Number(goal.displayPercent)}")
    expect(componentSource).not.toContain("baseCurrency")
  })

  it("keeps goals stacked inside the narrower desktop Dashboard column", () => {
    expect(componentSource).toContain(
      "xl:grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_minmax(12rem,0.7fr)_minmax(10rem,0.55fr)]"
    )
    expect(componentSource).toContain(
      "sm:col-span-2 xl:col-span-1 2xl:col-span-1"
    )
    expect(componentSource).toContain('className="min-w-0 flex-1"')
    expect(componentSource).toContain('className="mt-3 sm:mt-5"')
  })

  it("links to Goals and provides isolated loading, empty, and retry states", () => {
    expect(componentSource).toContain('to="/goals"')
    expect(componentSource).toContain("<SkeletonRows />")
    expect(componentSource).toContain("model.hasAnyGoals")
    expect(componentSource).toContain("void retry()")
    expect(componentSource).toContain("min-h-11")
  })
})
