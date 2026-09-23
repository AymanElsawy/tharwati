/// <reference types="node" />

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const styles = readFileSync(new URL("./index.css", import.meta.url), "utf8")

describe("native select theme", () => {
  it("gives native options explicit themed normal and interaction colors", () => {
    expect(styles).toMatch(
      /select option\s*{[^}]*color:\s*var\(--color-text-primary\);[^}]*background-color:\s*var\(--color-surface\);/s,
    )
    expect(styles).toMatch(/select option:hover\s*{[^}]*--color-surface-hover/s)
    expect(styles).toMatch(
      /select option:checked\s*{[^}]*--color-text-on-primary[^}]*--color-primary/s,
    )
    expect(styles).toMatch(
      /select option:disabled\s*{[^}]*--color-text-muted[^}]*--color-surface-muted/s,
    )
  })
})
