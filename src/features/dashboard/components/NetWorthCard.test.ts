import { describe, expect, it } from "vitest"

import componentSource from "./NetWorthCard.tsx?raw"

describe("NetWorthCard presentation", () => {
  it("keeps Dashboard financial values stable LTR and mobile metrics compact", () => {
    expect(componentSource).toContain('const locale = "en-US"')
    expect(componentSource).toContain('dir="ltr"')
    expect(componentSource).toContain(
      "grid grid-cols-2 gap-2 sm:mt-8 sm:grid-cols-3 sm:gap-3"
    )
    expect(componentSource).toContain('className="col-span-2 sm:col-span-1"')
    expect(componentSource).toContain("whitespace-nowrap")
    expect(componentSource).toContain("p-5 sm:p-8")
  })
})
