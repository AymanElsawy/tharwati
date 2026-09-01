import { describe, expect, it } from "vitest"

import dropdownMenu from "@/components/ui/dropdown-menu.tsx?raw"
import managerDialog from "./RecordCategoryManagerDialog.tsx?raw"

describe("RecordCategoryManagerDialog mobile actions", () => {
  it("portals menus above the category manager dialog", () => {
    expect(managerDialog).toContain('z-[110]')
    expect(dropdownMenu).toContain("positionerClassName")
    expect(managerDialog).toContain('positionerClassName="z-[120]"')
  })

  it("keeps logical-end alignment and rule-specific actions", () => {
    expect(managerDialog).toContain('<DropdownMenuContent align="end"')
    expect(managerDialog).toContain('accounts.categories.rename')
    expect(managerDialog).toContain('accounts.categories.hide')
    expect(managerDialog).toContain('accounts.categories.restore')
    expect(managerDialog).toContain('accounts.categories.archive')
  })

  it("keeps mobile menu items touch sized", () => {
    expect(managerDialog).toContain(
      '[&_[data-slot=dropdown-menu-item]]:min-h-11'
    )
  })
})
