import { describe, expect, it } from "vitest"

import dialog from "./AccountFormDialog.tsx?raw"

describe("AccountFormDialog mobile type picker", () => {
  it("keeps seven type options in a compact, scrollable radio list", () => {
    expect(dialog).toContain("accountTypeOptions.map")
    expect(dialog).toContain('className="h-full overflow-y-auto pe-1"')
    expect(dialog).toContain("min-h-11")
    expect(dialog).toContain('role="radio"')
  })

  it("shows a green selected radio and keeps footer actions visible", () => {
    expect(dialog).toContain("border-emerald-500 bg-emerald-50/70")
    expect(dialog).toContain("border-emerald-600")
    expect(dialog).toContain("sticky bottom-0 z-10")
    expect(dialog).toContain("disabled={selectedType === null}")
  })
})
