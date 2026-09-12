import { describe, expect, it } from "vitest"

import { ar } from "@/i18n/ar/translations"
import { en } from "@/i18n/en/translations"
import componentSource from "./AnalysisPage.tsx?raw"

describe("AnalysisPage", () => {
  it("is a localized Wealth Analysis shell", () => {
    expect(componentSource).toContain('t("pages.analysis.title")')
    expect(componentSource).toContain('t("pages.analysis.description")')
    expect(en["pages.analysis.title"]).toBe("Wealth Analysis")
    expect(ar["pages.analysis.title"]).toBe("تحليل الثروة")
  })
})
