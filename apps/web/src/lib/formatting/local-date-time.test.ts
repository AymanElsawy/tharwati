import { describe, expect, it } from "vitest"
import {
  formatLocalDateTime,
  formatLocalDateTimeInput,
  localDateTimeInputToIso,
} from "./local-date-time"

describe("formatLocalDateTime", () => {
  it("returns separate locally formatted date and time values", () => {
    const value = formatLocalDateTime("2026-08-19T12:34:56Z", "en-US")
    expect(value.date).not.toBe("2026-08-19")
    expect(value.time).not.toBe("")
  })

  it("creates datetime-local values from local, not UTC, date parts", () => {
    const value = new Date(2026, 7, 19, 12, 34)
    expect(formatLocalDateTimeInput(value)).toBe("2026-08-19T12:34")
  })

  it("converts a datetime-local value to the matching UTC instant", () => {
    const value = "2026-08-19T12:34"
    expect(localDateTimeInputToIso(value)).toBe(
      new Date(2026, 7, 19, 12, 34).toISOString()
    )
  })
})
