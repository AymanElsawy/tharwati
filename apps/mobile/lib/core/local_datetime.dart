/// Local date-time helpers — mirror the web `lib/formatting/local-date-time.ts`
/// used by the account-records feature. A "local datetime input" is the
/// `yyyy-MM-ddTHH:mm` string an HTML `<input type="datetime-local">` produces;
/// it is interpreted in the device's own time zone and converted to a UTC ISO
/// string for the RPCs.
library;

String _pad(int n) => n.toString().padLeft(2, '0');

/// `DateTime` → `yyyy-MM-ddTHH:mm` in local time (defaults to now).
String formatLocalDateTimeInput([DateTime? when]) {
  final d = (when ?? DateTime.now()).toLocal();
  return '${d.year}-${_pad(d.month)}-${_pad(d.day)}T${_pad(d.hour)}:${_pad(d.minute)}';
}

/// `yyyy-MM-ddTHH:mm` (local) → UTC ISO 8601 string for the RPC payloads.
String localDateTimeInputToIso(String input) {
  final parsed = DateTime.tryParse(input);
  if (parsed == null) return DateTime.now().toUtc().toIso8601String();
  // `DateTime.parse` of a bare `yyyy-MM-ddTHH:mm` yields a local DateTime.
  return parsed.toUtc().toIso8601String();
}

/// ISO string → `{date, time}` display parts in local time.
({String date, String time}) formatLocalDateTime(String iso) {
  final d = DateTime.tryParse(iso)?.toLocal();
  if (d == null) return (date: iso, time: '');
  return (
    date: '${d.year}-${_pad(d.month)}-${_pad(d.day)}',
    time: '${_pad(d.hour)}:${_pad(d.minute)}',
  );
}

const _months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/// `yyyy-MM-dd` → `"5 Jan 2026"` calendar label.
String formatLocalCalendarDate(String isoDate) {
  final parts = isoDate.split('-');
  if (parts.length != 3) return isoDate;
  final y = int.tryParse(parts[0]);
  final m = int.tryParse(parts[1]);
  final d = int.tryParse(parts[2]);
  if (y == null || m == null || d == null || m < 1 || m > 12) return isoDate;
  return '$d ${_months[m - 1]} $y';
}

/// The device's IANA time zone name where resolvable (best-effort; the RPC
/// accepts "UTC" as a safe fallback and only uses it to bucket local days).
String runtimeTimeZone() {
  try {
    final name = DateTime.now().timeZoneName;
    // Flutter returns abbreviations ("EET", "GMT+3") — the RPC wants an IANA
    // name, so fall back to UTC and let the offset ride on the ISO timestamps.
    if (name.length > 3 && name.contains('/')) return name;
  } catch (_) {}
  return 'UTC';
}
