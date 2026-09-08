import { describe, expect, it } from "vitest"

import form from "./AccountForm.tsx?raw"

describe("AccountForm ownership percentage direction", () => {
  it("isolates the numeric value and percent suffix from RTL layout", () => {
    expect(form).toContain('<div className="relative mt-1.5" dir="ltr">')
    expect(form).toContain("className={`${fieldClassName} mt-0 pe-10`}")
    expect(form).toContain('inputMode="decimal"')
    expect(form).toContain(
      "pointer-events-none absolute inset-y-0 end-3.5 flex items-center"
    )
  })

  it("uses premium native field styling without changing numeric input rules", () => {
    expect(form).toContain("min-h-11 w-full rounded-xl")
    expect(form).toContain('placeholder={t("accounts.form.namePlaceholder")}')
    expect(form).toContain('inputMode="decimal"')
    expect(form).toContain('className="space-y-3.5 sm:space-y-4"')
    expect(form).not.toContain("sectionClassName")
  })

  it("adds Business-only visual hierarchy without changing valuation fields", () => {
    expect(form).toContain('title={t("accounts.form.businessDetails")}')
    expect(form).toContain('accent="business"')
    expect(form).toContain('title: "text-[var(--color-success)]"')
    expect(form).toContain('title={t("accounts.form.initialValuation")}')
    expect(form).toContain(
      'description={t("accounts.form.initialValuationDescription")}'
    )
    expect(form).toContain('accountTypeCode === "business"')
    expect(form).toContain('accent="valuation"')
    expect(form).toContain(
      'title: "text-[var(--color-valuation-accent)]"'
    )
    expect(form).toContain(
      'description: "text-[var(--color-text-secondary)]"'
    )
    expect(form).toContain('isValuedAccount && mode === "create"')
    expect(form).toContain("businessValuationMethodOptions.map")
    expect(form).toContain('values.valuationMethod === "other"')
  })
})
