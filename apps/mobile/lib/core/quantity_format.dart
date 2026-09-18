import 'decimals.dart';

/// Presentation-only quantity formatting. Stored quantities remain decimal
/// strings; this rounds only at the display boundary then removes non-meaningful
/// trailing zeros (for example, `2.0000000000` becomes `2`).
String formatQuantity(
  String? value, {
  required int fractionDigits,
  String unavailableLabel = '—',
}) {
  final normalized = D.normalize(value);
  if (normalized == null) return unavailableLabel;
  final rounded = D.divide(normalized, '1', scale: fractionDigits);
  if (rounded == null) return unavailableLabel;
  if (!rounded.contains('.')) return rounded;
  final trimmed = rounded.replaceFirst(RegExp(r'0+$'), '');
  return trimmed.endsWith('.')
      ? trimmed.substring(0, trimmed.length - 1)
      : trimmed;
}
