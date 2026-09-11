import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/settings/settings_profile_repository.dart';

void main() {
  test('normalizes a full name the same way as web Settings', () {
    expect(normalizeFullName('  Ada Lovelace  '), 'Ada Lovelace');
    expect(normalizeFullName(' \t '), isNull);
    expect(normalizeFullName(null), isNull);
  });
}
