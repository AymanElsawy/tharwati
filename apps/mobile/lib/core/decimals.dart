import 'package:decimal/decimal.dart';

/// Exact-precision decimal helpers over `package:decimal`, string in / string
/// out, returning `null` on invalid input — mirroring the web app's
/// `lib/financial-calculations/decimal.ts` so ported logic behaves identically.
///
/// Money and quantity values travel as decimal strings everywhere
/// (docs/dashboard.md §7); never parse them into `double`.
class D {
  D._();

  static final RegExp _pattern = RegExp(r'^[+-]?\d+(?:\.\d+)?$');

  /// Returns a canonical decimal string, or null if [value] is not a plain
  /// decimal literal.
  static String? normalize(String? value) {
    if (value == null) return null;
    final trimmed = value.trim();
    if (!_pattern.hasMatch(trimmed)) return null;
    return Decimal.parse(trimmed).toString();
  }

  static Decimal? _parse(String? value) {
    final normalized = normalize(value);
    return normalized == null ? null : Decimal.parse(normalized);
  }

  static String? add(String? a, String? b) {
    final x = _parse(a);
    final y = _parse(b);
    return (x == null || y == null) ? null : (x + y).toString();
  }

  static String? subtract(String? a, String? b) {
    final x = _parse(a);
    final y = _parse(b);
    return (x == null || y == null) ? null : (x - y).toString();
  }

  static String? multiply(String? a, String? b) {
    final x = _parse(a);
    final y = _parse(b);
    return (x == null || y == null) ? null : (x * y).toString();
  }

  /// Rounds half-up to [scale] fraction digits, like the web's `divideDecimals`.
  static String? divide(String? a, String? b, {int scale = 10}) {
    final x = _parse(a);
    final y = _parse(b);
    if (x == null || y == null || y == Decimal.zero) return null;
    final quotient = (x / y).toDecimal(scaleOnInfinitePrecision: scale + 2);
    return quotient.round(scale: scale).toString();
  }

  /// Sums [values]; null if any element is invalid.
  static String? sum(Iterable<String?> values) {
    var total = '0';
    for (final value in values) {
      final next = add(total, value);
      if (next == null) return null;
      total = next;
    }
    return total;
  }

  /// -1 / 0 / 1, or null if either side is invalid.
  static int? compare(String? a, String? b) {
    final x = _parse(a);
    final y = _parse(b);
    return (x == null || y == null) ? null : x.compareTo(y);
  }

  static bool isPositive(String? value) => (compare(value, '0') ?? 0) > 0;
}
