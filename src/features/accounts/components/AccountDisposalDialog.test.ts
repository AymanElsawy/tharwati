import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

import dialog from "./AccountDisposalDialog.tsx?raw"
import { ar } from "@/i18n/ar/translations"
import { en } from "@/i18n/en/translations"
import english from "@/i18n/en/translations.ts?raw"
import { LanguageProvider } from "@/i18n/LanguageProvider"
import { useTranslation } from "@/i18n/useTranslation"

function OwnershipMessage() {
  const { t } = useTranslation()
  return createElement(
    "span",
    null,
    t("accounts.disposal.fullSaleOnly", { percentage: "100" }),
  )
}

afterEach(() => vi.unstubAllGlobals())

describe("AccountDisposalDialog", () => {
  it("remounts clean form state per account and has no SAR fallback", () => {
    expect(dialog).toContain("key={props.account.id}")
    expect(dialog).toContain("createAccountDisposalFormState(account)")
    expect(dialog).not.toContain('account?.currency_code ?? "SAR"')
  })

  it("uses the exact approved destination label and sends no destination for zero", () => {
    expect(english).toContain(
      '"accounts.disposal.destinationAccount": "Where did the money go?"'
    )
    expect(dialog).toMatch(
      /destinationAccountId:\s*positiveProceeds\s*\?\s*form\.destinationAccountId\s*:\s*null/
    )
    expect(dialog).toContain("getEligibleDisposalDestinationAccounts")
    expect(dialog).toContain("resolveAccountDisposalSubmissionAttempt")
    expect(dialog).toContain("idempotencyKey: submissionAttempt.current.idempotencyKey")
  })

  it("renders remaining ownership instead of a literal percentage placeholder", () => {
    vi.stubGlobal("localStorage", { getItem: () => null })
    const message = renderToStaticMarkup(
      createElement(LanguageProvider, null, createElement(OwnershipMessage)),
    )

    expect(message).toContain("100%")
    expect(message).not.toContain("{percentage}")
    expect(en["accounts.disposal.fullSaleOnly"]).toContain("{{percentage}}")
    expect(ar["accounts.disposal.fullSaleOnly"]).toContain("{{percentage}}")
  })
})
