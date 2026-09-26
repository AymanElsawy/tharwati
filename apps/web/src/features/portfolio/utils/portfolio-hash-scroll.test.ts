import { describe, expect, it, vi } from "vitest"

import { scrollPortfolioHashWhenReady } from "./portfolio-hash-scroll"

function targetDocument() {
  const scrollIntoView = vi.fn()
  const getElementById = vi.fn((): { scrollIntoView: typeof scrollIntoView } | null => ({ scrollIntoView }))
  return {
    root: { getElementById } as unknown as Pick<Document, "getElementById">,
    getElementById,
    scrollIntoView,
  }
}

describe("Portfolio hash navigation", () => {
  it("scrolls when Portfolio is already loaded", () => {
    const { root, getElementById, scrollIntoView } = targetDocument()
    expect(scrollPortfolioHashWhenReady("#portfolio-concentration", true, root)).toBe(true)
    expect(getElementById).toHaveBeenCalledWith("portfolio-concentration")
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" })
  })

  it("waits for async Portfolio data before scrolling to Holdings", () => {
    const { root, getElementById, scrollIntoView } = targetDocument()
    expect(scrollPortfolioHashWhenReady("#portfolio-holdings-title", false, root)).toBe(false)
    expect(getElementById).not.toHaveBeenCalled()
    expect(scrollPortfolioHashWhenReady("#portfolio-holdings-title", true, root)).toBe(true)
    expect(getElementById).toHaveBeenCalledWith("portfolio-holdings-title")
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it("ignores unrelated or missing hash targets", () => {
    const { root, getElementById, scrollIntoView } = targetDocument()
    expect(scrollPortfolioHashWhenReady("#unknown", true, root)).toBe(false)
    expect(getElementById).not.toHaveBeenCalled()
    getElementById.mockReturnValueOnce(null)
    expect(scrollPortfolioHashWhenReady("#portfolio-concentration", true, root)).toBe(false)
    expect(scrollIntoView).not.toHaveBeenCalled()
  })
})
