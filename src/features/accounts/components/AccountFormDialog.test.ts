import { describe, expect, it } from "vitest"

import dialog from "./AccountFormDialog.tsx?raw"

describe("AccountFormDialog mobile type picker", () => {
  it("keeps seven type options in a compact, scrollable radio list", () => {
    expect(dialog).toContain("accountTypeOptions.map")
    expect(dialog).toContain('className="h-full overflow-y-auto pe-1"')
    expect(dialog).toContain("min-h-11")
    expect(dialog).toContain('role="radio"')
  })

  it("uses selected account visual, semantic header, and persistent footer", () => {
    expect(dialog).toContain("accent.selected")
    expect(dialog).toContain("<Dialog.Title")
    expect(dialog).toContain("<Dialog.Description")
    expect(dialog).toContain("sr-only")
    expect(dialog).toContain("sticky bottom-0 z-10")
    expect(dialog).toContain("disabled={selectedType === null}")
  })

  it("keeps type identity without duplicating create or edit context", () => {
    expect(dialog).toContain(
      "getAccountTypeLabel(effectiveDefaults.accountTypeCode, t)"
    )
    expect(dialog).not.toContain(
      "tracking-wide text-muted-foreground uppercase"
    )
  })
})

describe("AccountFormDialog Continue direction", () => {
  it("uses a logical-direction arrow without changing the CTA label", () => {
    expect(dialog).toContain('const { direction, t } = useTranslation()')
    expect(dialog).toContain('direction === "rtl"')
    expect(dialog).toContain("<ChevronLeft")
    expect(dialog).toContain("<ChevronRight")
    expect(dialog).toContain('t("common.continue")')
  })
})
