import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/theme/app_theme_controller.dart';

void main() {
  test(
    'switches Light/Dark and restores the locally persisted choice',
    () async {
      final store = _FakeThemeStore();
      final controller = AppThemeController(store: store);

      await controller.setThemeMode(ThemeMode.dark);

      expect(controller.themeMode, ThemeMode.dark);
      expect(store.value, 'dark');

      final restored = AppThemeController(store: store);
      await restored.load();
      expect(restored.themeMode, ThemeMode.dark);
    },
  );

  test('uses Light for absent or unsupported saved preferences', () async {
    final controller = AppThemeController(store: _FakeThemeStore('colorful'));

    await controller.load();

    expect(controller.themeMode, ThemeMode.light);
  });
}

class _FakeThemeStore implements ThemeStore {
  _FakeThemeStore([this.value]);

  String? value;

  @override
  Future<String?> readTheme() async => value;

  @override
  Future<void> writeTheme(String code) async {
    value = code;
  }
}
