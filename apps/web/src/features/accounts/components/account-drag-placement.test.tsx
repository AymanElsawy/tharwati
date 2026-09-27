import { createRef } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { moveAccountWithinSection } from "../utils/account-custom-order"
import { AccountDragPreview, AccountInsertionGap } from "./AccountDragVisuals"
import { dropTargetId, insertionBeforeId, insertionIndexForPointer } from "./account-drag-placement"

const ids = ["bank", "cash", "gold"]

describe("Account drag placement", () => {
  it("distinguishes before and after the hovered row", () => {
    expect(insertionIndexForPointer(ids, "bank", "cash", 109, 100, 40)).toBe(0)
    expect(insertionIndexForPointer(ids, "bank", "cash", 130, 100, 40)).toBe(1)
    expect(insertionIndexForPointer(ids, "bank", "gold", 130, 100, 40)).toBe(2)
  })

  it("uses the source placeholder for a no-op and rejects other sections", () => {
    expect(insertionIndexForPointer(ids, "cash", "cash", 105, 100, 40)).toBe(1)
    expect(insertionIndexForPointer(ids, "cash", "closed-account", 105, 100, 40)).toBeNull()
    expect(dropTargetId(ids, "cash", 1)).toBeNull()
  })

  it("maps a visible insertion gap back to the existing source/target contract", () => {
    const index = insertionIndexForPointer(ids, "gold", "bank", 105, 100, 40)!
    expect(insertionBeforeId(ids, "gold", index)).toBe("bank")
    expect(dropTargetId(ids, "gold", index)).toBe("bank")
    expect(moveAccountWithinSection(["closed", ...ids, "sold"], ids, "gold", "bank"))
      .toEqual(["closed", "gold", "bank", "cash", "sold"])
    expect(insertionBeforeId(ids, "bank", 2)).toBeNull()
    expect(dropTargetId(ids, "bank", 2)).toBe("gold")
  })

  it("renders a full-size pointer-following shell with grab-point origin and RTL direction", () => {
    const html = renderToStaticMarkup(
      <AccountDragPreview
        variant="card"
        sourceClone={{} as HTMLElement}
        cellWidths={[]}
        fontFamily="Geist"
        width={320}
        height={96}
        x={40}
        y={60}
        offsetX={18}
        offsetY={24}
        direction="rtl"
        previewRef={createRef<HTMLDivElement>()}
      />
    )
    expect(html).toContain('data-account-drag-preview="card"')
    expect(html).toContain('dir="rtl"')
    expect(html).toContain("translate3d(40px, 60px, 0) scale(1.02)")
    expect(html).toContain("transform-origin:18px 24px")
    expect(html).toContain('aria-hidden="true"')
  })

  it("renders distinct desktop and card insertion gaps", () => {
    const table = renderToStaticMarkup(<table><tbody><AccountInsertionGap variant="table" height={64} /></tbody></table>)
    const card = renderToStaticMarkup(<AccountInsertionGap variant="card" height={96} />)
    expect(table).toContain('data-order-gap="table"')
    expect(table).toContain('colSpan="6"')
    expect(card).toContain('data-order-gap="card"')
    expect(card).toContain("height:88px")
  })
})
