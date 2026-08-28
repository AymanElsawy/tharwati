import { describe, expect, it } from "vitest"

import page from "./AccountDetailsPage.tsx?raw"

describe("valued account details metadata", () => {
  it("shows the approved Business and Real Estate metadata fields", () => {
    expect(page).toContain("getBusinessTypeLabel(account.business_type, t)")
    expect(page).toContain("getIndustryLabel(account.industry, t)")
    expect(page).toContain("getPropertyTypeLabel(account.property_type, t)")
    expect(page).toContain('t("accounts.form.ownershipPercentage")')
    expect(page).toContain('t("accounts.form.location")')
    expect(page).toContain('t("accounts.form.notes")')
  })
})
