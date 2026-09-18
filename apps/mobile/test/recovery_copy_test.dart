import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/i18n/app_language.dart';
import 'package:tharwati_mobile/i18n/recovery_copy.dart';

void main() {
  test('English and Arabic recovery copy use the 60-minute contract', () {
    expect(
      RecoveryCopy.of(AppLanguage.en).resetEmailSubtitle,
      contains('60 minutes'),
    );
    expect(
      RecoveryCopy.of(AppLanguage.ar).resetEmailSubtitle,
      contains('60 دقيقة'),
    );
  });
}
