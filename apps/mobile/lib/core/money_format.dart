import 'package:decimal/decimal.dart';

import 'decimals.dart';

/// Number / currency / date formatting for the app, following the web's
/// conventions (docs/dashboard.md §3.3):
///
/// - money: exactly 2 fraction digits, grouped thousands, `"{amount} {CODE}"`.
/// - percentages: up to 2 fraction digits, no forced minimum.
/// - signed values: leading `+` unless already negative; "Unavailable" for null.
/// - every numeric/currency/date string renders left-to-right even on an RTL
///   page — callers wrap these in a `Directionality(textDirection: ltr)` or a
///   `Text(..., textDirection: TextDirection.ltr)`.
class MoneyFormat {
  MoneyFormat._();

  /// `"1,284,900.75 EGP"`. [amount] is a decimal string; returns
  /// [unavailableLabel] when it is null or invalid.
  static String money(
    String? amount,
    String currencyCode, {
    String unavailableLabel = 'Unavailable',
  }) {
    final normalized = D.normalize(amount);
    if (normalized == null) return unavailableLabel;
    return '${_group(Decimal.parse(normalized), 2)} $currencyCode';
  }

  /// Signed money — `"+12,400.00 EGP"` / `"-3,120.00 EGP"`.
  static String signedMoney(String? amount, String currencyCode) {
    final normalized = D.normalize(amount);
    if (normalized == null) return 'Unavailable';
    final value = Decimal.parse(normalized);
    final sign = value > Decimal.zero ? '+' : '';
    return '$sign${money(normalized, currencyCode)}';
  }

  /// `"68%"` / `"0.09%"` — up to 2 fraction digits, trailing zeros trimmed.
  static String percent(String? value) {
    final normalized = D.normalize(value);
    if (normalized == null) return 'Unavailable';
    return '${_group(Decimal.parse(normalized), 2, trimFraction: true)}%';
  }

  /// A compact hero label like `"1.37M"` for donut centers.
  static String compact(String? amount) {
    final normalized = D.normalize(amount);
    if (normalized == null) return '—';
    final value = Decimal.parse(normalized).toDouble().abs();
    final sign = normalized.startsWith('-') ? '-' : '';
    if (value >= 1e9) return '$sign${(value / 1e9).toStringAsFixed(2)}B';
    if (value >= 1e6) return '$sign${(value / 1e6).toStringAsFixed(2)}M';
    if (value >= 1e3) return '$sign${(value / 1e3).toStringAsFixed(1)}K';
    return '$sign${value.toStringAsFixed(0)}';
  }

  static String _group(
    Decimal value,
    int fractionDigits, {
    bool trimFraction = false,
  }) {
    final negative = value < Decimal.zero;
    final abs = negative ? -value : value;
    final fixed = abs.toStringAsFixed(fractionDigits);
    final parts = fixed.split('.');
    final intPart = parts[0];
    var fraction = parts.length > 1 ? parts[1] : '';
    if (trimFraction) {
      fraction = fraction.replaceFirst(RegExp(r'0+$'), '');
    }

    final buffer = StringBuffer();
    for (var i = 0; i < intPart.length; i++) {
      if (i != 0 && (intPart.length - i) % 3 == 0) buffer.write(',');
      buffer.write(intPart[i]);
    }

    final grouped = buffer.toString();
    final withFraction = fraction.isEmpty ? grouped : '$grouped.$fraction';
    return negative ? '-$withFraction' : withFraction;
  }
}
