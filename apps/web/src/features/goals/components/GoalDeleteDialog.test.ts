import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ar } from "@/i18n/ar/translations"
import { en } from "@/i18n/en/translations"
import { LanguageProvider } from "@/i18n/LanguageProvider"
import { useTranslation } from "@/i18n/useTranslation"
import dialog from "./GoalDeleteDialog.tsx?raw"

function DeleteCopy({ goalName }: { goalName: string }) {
  const { t } = useTranslation()
  return createElement(
    "div",
    null,
    createElement("h2", null, t("goals.deleteTitle")),
    createElement("p", null, t("goals.deletePrompt", { goalName })),
    createElement("button", null, t("goals.keepGoal")),
    createElement("button", null, t("goals.delete")),
  )
}

function renderCopy(language: "en" | "ar", goalName: string) {
  vi.stubGlobal("localStorage", { getItem: () => language })
  return renderToStaticMarkup(
    createElement(
      LanguageProvider,
      null,
      createElement(DeleteCopy, { goalName }),
    ),
  )
}

afterEach(() => vi.unstubAllGlobals())

describe("GoalDeleteDialog", () => {
  it("renders English copy with the selected Goal name", () => {
    const html = renderCopy("en", "Emergency fund")

    expect(html).toContain("Delete goal?")
    expect(html).toContain(
      "Permanently delete “Emergency fund”? This action cannot be undone.",
    )
    expect(html).toContain("Keep goal")
    expect(en["goals.deletePrompt"]).toContain("{{goalName}}")
  })

  it("renders localized Arabic copy with the selected Goal name", () => {
    const html = renderCopy("ar", "صندوق الطوارئ")

    expect(html).toContain("حذف الهدف؟")
    expect(html).toContain(
      "حذف “صندوق الطوارئ” نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.",
    )
    expect(html).toContain("الاحتفاظ بالهدف")
    expect(ar["goals.deletePrompt"]).toContain("{{goalName}}")
  })

  it("uses an explicit destructive confirmation action", () => {
    expect(dialog).toContain('variant="destructive"')
    expect(dialog).toContain("onClick={onConfirm}")
    expect(dialog).toContain("onClick={onCancel}")
    expect(dialog).toContain("data-goal-delete-confirm")
  })
})
