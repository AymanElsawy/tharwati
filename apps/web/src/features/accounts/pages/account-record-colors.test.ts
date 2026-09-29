import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { netColor, recordColor } from "./account-record-colors"
import form from "../components/AccountRecordFormDialog.tsx?raw"

const themeCss = readFileSync(new URL("../../../index.css", import.meta.url), "utf8")

describe("Account Record semantic colors", () => {
  it("uses theme success, danger, and neutral roles for record types", () => {
    expect(recordColor("income")).toBe("text-[var(--color-success)]")
    expect(recordColor("refund")).toBe("text-[var(--color-success)]")
    expect(recordColor("expense")).toBe("text-[var(--color-danger)]")
    expect(recordColor("transfer")).toBe("")
  })

  it("uses decimal-safe sign for daily net, including formatted zero", () => {
    expect(netColor("25.00")).toBe("text-[var(--color-success)]")
    expect(netColor("-25.00")).toBe("text-[var(--color-danger)]")
    expect(netColor("0.00")).toBe("text-muted-foreground")
    expect(netColor("-0.00")).toBe("text-muted-foreground")
  })

  it("binds dark utilities to the selected app theme and keeps type controls semantic", () => {
    expect(themeCss).toContain('@custom-variant dark (&:where(:root[data-theme="dark"], :root[data-theme="dark"] *));')
    expect(form).toContain('bg-[var(--color-success)]')
    expect(form).toContain('bg-[var(--color-danger)]')
    expect(form).toContain('bg-[var(--color-text-primary)]')
  })
})
