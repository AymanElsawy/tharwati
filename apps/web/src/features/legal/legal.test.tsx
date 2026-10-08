import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import legalCopy from "../../../../../docs/legal-copy.json"
import { LanguageContext, type Language } from "@/i18n/context"
import { en } from "@/i18n/en/translations"
import { ar } from "@/i18n/ar/translations"
import { PublicLegalRoutes } from "@/app/PublicLegalApp"
import { SignUpPage } from "@/features/auth/SignUpPage"
import { SettingsPage } from "@/features/settings/pages/SettingsPage"
import { loadRouteApp } from "@/app/load-route-app"

const { normalLoaded } = vi.hoisted(() => ({ normalLoaded: vi.fn() }))
vi.mock("@/app/NormalApp", () => {
  normalLoaded()
  return { default: () => null }
})
vi.mock("@/lib/supabase", () => {
  throw new Error("Public legal pages must not initialize Supabase")
})
vi.mock("@/features/auth/auth.service", () => ({
  signUp: vi.fn(),
  PASSWORD_MIN_LENGTH: 12,
  meetsPasswordRequirements: vi.fn(),
  isWeakPasswordError: vi.fn(),
}))
vi.mock("@/features/profile/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({ fullName: "Ada", email: "ada@example.com" }),
}))
vi.mock("@/features/profile/repositories/profile.repository", () => ({
  updateCurrentUserFullName: vi.fn(),
}))
vi.mock("@/features/privacy/services/user-data-export.service", () => ({
  UserDataExportError: class extends Error {},
  userDataExportService: {},
}))
vi.mock("@/features/settings/components/DeleteAccountDialog", () => ({
  DeleteAccountDialog: () => null,
}))

function render(node: ReactNode, language: Language, path = "/") {
  const dictionary = language === "ar" ? ar : en
  return renderToStaticMarkup(
    <LanguageContext.Provider
      value={{
        language,
        direction: language === "ar" ? "rtl" : "ltr",
        setLanguage: () => {},
        t: (key, params) => {
          let value: string = dictionary[key]
          for (const [name, replacement] of Object.entries(params ?? {}))
            value = value.replaceAll(`{{${name}}}`, String(replacement))
          return value
        },
      }}
    >
      <MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>
    </LanguageContext.Provider>
  )
}

function escaped(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

describe("L1-B legal pages and entry links", () => {
  it("loads both public routes without Supabase or the auth application", async () => {
    for (const path of ["/privacy", "/terms", "/privacy/", "/terms/"]) {
      const module = await loadRouteApp(path)
      expect(module.default.name).toBe("PublicLegalApp")
    }
    expect(normalLoaded).not.toHaveBeenCalled()
  })

  it("keeps delete-account and other paths in the existing application", async () => {
    await loadRouteApp("/delete-account")
    expect(normalLoaded).toHaveBeenCalledOnce()
    expect((await loadRouteApp("/signup")).default.name).not.toBe(
      "PublicLegalApp"
    )
  })

  for (const language of ["en", "ar"] as const) {
    for (const document of ["privacy", "terms"] as const) {
      it(`renders every approved ${document} block and date in ${language}`, () => {
        const copy = legalCopy.documents[document][language]
        const html = render(
          <PublicLegalRoutes />,
          language,
          `/${document}?lang=${language}`
        )
        expect(html).toContain(`lang="${language}"`)
        expect(html).toContain(`dir="${language === "ar" ? "rtl" : "ltr"}"`)
        expect(html).toContain(escaped(copy.title))
        expect(html).toContain(
          `dateTime="2026-10-07">${copy.updatedDate}</time>`
        )
        expect(html.match(/<h2 /g)).toHaveLength(9)
        expect(html).toContain('href="mailto:tharwatiwealth@gmail.com"')
        for (const block of copy.blocks) {
          for (const line of block.split("\n"))
            expect(html).toContain(escaped(line.replace(/^- /u, "")))
        }
        expect(html).not.toContain("undefined")
      })
    }
    for (const [name, Page] of [
      ["Signup", SignUpPage],
      ["Settings", SettingsPage],
    ] as const) {
      it(`renders working ${name} links in ${language} without form submission`, () => {
        const html = render(<Page />, language)
        for (const document of ["privacy", "terms"] as const) {
          expect(html).toContain(
            `href="/${document}?lang=${language}" target="_blank" rel="noopener noreferrer"`
          )
          expect(html).toContain(
            (language === "ar" ? ar : en)[`legal.${document}`]
          )
        }
        expect(html).not.toContain("links will be available")
      })
    }
  }
})
