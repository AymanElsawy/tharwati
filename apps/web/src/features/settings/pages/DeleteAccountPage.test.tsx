import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import ts from "typescript"
import { describe, expect, it } from "vitest"

import appSource from "@/app/App.tsx?raw"
import { ar } from "@/i18n/ar/translations"
import { LanguageContext, type Language } from "@/i18n/context"
import { en } from "@/i18n/en/translations"
import { DeleteAccountPage } from "./DeleteAccountPage"

function renderPage(signedIn: boolean, language: Language) {
  const dictionary = language === "ar" ? ar : en
  return renderToStaticMarkup(
    <LanguageContext.Provider
      value={{
        language,
        direction: language === "ar" ? "rtl" : "ltr",
        setLanguage: () => {},
        t: (key, params) => {
          let value: string = dictionary[key]
          for (const [name, replacement] of Object.entries(params ?? {})) {
            value = value.replaceAll(`{{${name}}}`, String(replacement))
          }
          return value
        },
      }}
    >
      <MemoryRouter initialEntries={["/delete-account"]}>
        <DeleteAccountPage signedIn={signedIn} />
      </MemoryRouter>
    </LanguageContext.Provider>
  )
}

describe("public account deletion page", () => {
  it("registers /delete-account directly under Routes outside the auth guard", () => {
    const source = ts.createSourceFile(
      "App.tsx",
      appSource,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    )
    const matchingRoutes: ts.JsxSelfClosingElement[] = []
    function visit(node: ts.Node) {
      if (
        ts.isJsxSelfClosingElement(node) &&
        node.tagName.getText(source) === "Route" &&
        node.attributes.properties.some(
          (attribute) =>
            ts.isJsxAttribute(attribute) &&
            attribute.name.getText(source) === "path" &&
            attribute.initializer &&
            ts.isStringLiteral(attribute.initializer) &&
            attribute.initializer.text === "/delete-account"
        )
      )
        matchingRoutes.push(node)
      ts.forEachChild(node, visit)
    }
    visit(source)
    expect(matchingRoutes).toHaveLength(1)
    const route = matchingRoutes[0]
    expect(ts.isJsxElement(route.parent)).toBe(true)
    expect(
      (route.parent as ts.JsxElement).openingElement.tagName.getText(source)
    ).toBe("Routes")
    expect(route.getText(source)).toContain(
      "<DeleteAccountPage signedIn={Boolean(session)} />"
    )
  })

  for (const language of ["en", "ar"] as const) {
    const dictionary = language === "ar" ? ar : en

    it(`allows signed-out access with a sign-in link in ${language}`, () => {
      const html = renderPage(false, language)
      expect(html).toContain('href="/login"')
      expect(html).toContain(dictionary["settings.deletePage.signIn"])
      expect(html).not.toContain('href="/settings"')
    })

    it(`provides the signed-in path to the existing Settings deletion flow in ${language}`, () => {
      const html = renderPage(true, language)
      expect(html).toContain('href="/settings"')
      expect(html).toContain(dictionary["settings.deletePage.openSettings"])
      expect(html).not.toContain('href="/login"')
    })

    it(`renders localized identity, deletion instructions, warning, and direction in ${language}`, () => {
      const html = renderPage(false, language)
      expect(html).toContain(`lang="${language}"`)
      expect(html).toContain(`dir="${language === "ar" ? "rtl" : "ltr"}"`)
      for (const key of [
        "settings.deletePage.brand",
        "settings.deletePage.title",
        "settings.deletePage.description",
        "settings.deletePage.instructions",
        "settings.delete.permanentWarning",
      ] as const) {
        expect(html).toContain(dictionary[key])
      }
      expect(html).toContain(language === "ar" ? "English" : "العربية")
      expect(html).not.toContain("settings.deletePage.")
    })
  }
})
