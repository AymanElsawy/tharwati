import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/core/quantity_format.dart';

void main() {
  group('formatQuantity', () {
    test('removes non-meaningful trailing zeros', () {
      expect(formatQuantity('2.0000000000', fractionDigits: 6), '2');
      expect(formatQuantity('2.5000000000', fractionDigits: 6), '2.5');
    });

    test('preserves meaningful precision within the asset display limit', () {
      expect(formatQuantity('1.23456789', fractionDigits: 8), '1.23456789');
      expect(formatQuantity('1.23456789', fractionDigits: 6), '1.234568');
    });

    test('does not turn invalid values into zero', () {
      expect(formatQuantity('not-a-decimal', fractionDigits: 6), '—');
    });
  });
}
