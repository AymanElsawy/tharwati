import { describe, expect, it } from "vitest"

import form from "./AccountForm.tsx?raw"

describe("AccountForm ownership percentage direction", () => {
  it("isolates the numeric value and percent suffix from RTL layout", () => {
    expect(form).toContain('<div className="relative mt-1.5" dir="ltr">')
    expect(form).toContain('className={`${fieldClassName} mt-0 pe-10`}')
    expect(form).toContain('inputMode="decimal"')
    expect(form).toContain(
      'pointer-events-none absolute inset-y-0 end-3.5 flex items-center'
    )
  })
})
