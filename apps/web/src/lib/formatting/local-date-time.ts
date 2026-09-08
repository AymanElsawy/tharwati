export type LocalDateTime = {
  date: string
  time: string
}

/** Returns the IANA timezone used by the current runtime for local-calendar calculations. */
export function getRuntimeTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
}

/** Formats an ISO local-calendar date without shifting it into a different timezone. */
export function formatLocalCalendarDate(date: string, locale: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00.000Z`)
  )
}

function pad(value: number) {
  return String(value).padStart(2, "0")
}

/** Returns a value suitable for a datetime-local input in the runtime's local timezone. */
export function formatLocalDateTimeInput(value: Date = new Date()) {
  return [
    value.getFullYear(),
    pad(value.getMonth() + 1),
    pad(value.getDate()),
  ].join("-") + `T${pad(value.getHours())}:${pad(value.getMinutes())}`
}

/** Converts a datetime-local value from the runtime's local timezone to its UTC ISO representation. */
export function localDateTimeInputToIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) throw new Error("Invalid local date and time")

  const [, year, month, day, hour, minute] = match
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute)
  ).toISOString()
}

/** Formats an ISO timestamp in the runtime device's local timezone. */
export function formatLocalDateTime(
  timestamp: string,
  locale: string
): LocalDateTime {
  const value = new Date(timestamp)
  if (Number.isNaN(value.getTime())) return { date: timestamp, time: "" }

  return {
    date: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(value),
    time: new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(value),
  }
}
