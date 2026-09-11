import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/i18n/app_language.dart';

void main() {
  test('switches language and restores the locally persisted choice', () async {
    final store = _FakeLanguageStore();
    final controller = AppLanguageController(store: store);

    await controller.setLanguage(AppLanguage.ar);

    expect(controller.language, AppLanguage.ar);
    expect(store.value, 'ar');

    final restored = AppLanguageController(store: store);
    await restored.load();
    expect(restored.language, AppLanguage.ar);
  });

  test('maps English and Arabic to LTR and RTL', () {
    expect(AppLanguage.en.direction, TextDirection.ltr);
    expect(AppLanguage.ar.direction, TextDirection.rtl);
  });
}

class _FakeLanguageStore implements LanguageStore {
  String? value;

  @override
  Future<String?> readLanguage() async => value;

  @override
  Future<void> writeLanguage(String code) async {
    value = code;
  }
}
