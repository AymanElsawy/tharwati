import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

abstract interface class ThemeStore {
  Future<String?> readTheme();
  Future<void> writeTheme(String code);
}

class SharedPreferencesThemeStore implements ThemeStore {
  static const _key = 'tharwati-theme';
  final SharedPreferencesAsync _preferences = SharedPreferencesAsync();

  @override
  Future<String?> readTheme() => _preferences.getString(_key);

  @override
  Future<void> writeTheme(String code) => _preferences.setString(_key, code);
}

/// App-wide Light/Dark preference. It is device-local and is available before
/// authentication, matching the web appearance preference behavior.
class AppThemeController extends ChangeNotifier {
  AppThemeController({ThemeStore? store})
    : _store = store ?? SharedPreferencesThemeStore();

  final ThemeStore _store;
  ThemeMode _themeMode = ThemeMode.light;

  ThemeMode get themeMode => _themeMode;

  Future<void> load() async {
    final next = _fromCode(await _store.readTheme());
    if (next == _themeMode) return;
    _themeMode = next;
    notifyListeners();
  }

  Future<void> setThemeMode(ThemeMode themeMode) async {
    if (themeMode != ThemeMode.light && themeMode != ThemeMode.dark) return;
    if (themeMode == _themeMode) return;
    _themeMode = themeMode;
    notifyListeners();
    await _store.writeTheme(themeMode.name);
  }

  static ThemeMode _fromCode(String? code) =>
      code == ThemeMode.dark.name ? ThemeMode.dark : ThemeMode.light;
}

class AppThemeScope extends InheritedNotifier<AppThemeController> {
  const AppThemeScope({
    super.key,
    required AppThemeController controller,
    required super.child,
  }) : super(notifier: controller);

  static AppThemeController of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppThemeScope>();
    assert(scope != null, 'AppThemeScope is required above this widget.');
    return scope!.notifier!;
  }
}
