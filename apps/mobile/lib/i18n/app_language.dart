import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum AppLanguage {
  en('en', TextDirection.ltr),
  ar('ar', TextDirection.rtl);

  const AppLanguage(this.code, this.direction);

  final String code;
  final TextDirection direction;

  Locale get locale => Locale(code);

  String get displayName => switch (this) {
    AppLanguage.en => 'English',
    AppLanguage.ar => 'العربية',
  };

  static AppLanguage fromCode(String? code) =>
      code == ar.code ? ar : en;
}

abstract interface class LanguageStore {
  Future<String?> readLanguage();
  Future<void> writeLanguage(String code);
}

class SharedPreferencesLanguageStore implements LanguageStore {
  static const _key = 'tharwati-language';
  final SharedPreferencesAsync _preferences = SharedPreferencesAsync();

  @override
  Future<String?> readLanguage() => _preferences.getString(_key);

  @override
  Future<void> writeLanguage(String code) => _preferences.setString(_key, code);
}

/// App-wide locale state. It is deliberately device-local and available before
/// authentication, matching the web language preference behavior.
class AppLanguageController extends ChangeNotifier {
  AppLanguageController({LanguageStore? store})
    : _store = store ?? SharedPreferencesLanguageStore();

  final LanguageStore _store;
  AppLanguage _language = AppLanguage.en;

  AppLanguage get language => _language;

  Future<void> load() async {
    final saved = await _store.readLanguage();
    final next = AppLanguage.fromCode(saved);
    if (next == _language) {
      return;
    }
    _language = next;
    notifyListeners();
  }

  Future<void> setLanguage(AppLanguage language) async {
    if (language == _language) {
      return;
    }
    _language = language;
    notifyListeners();
    await _store.writeLanguage(language.code);
  }
}

class AppLanguageScope extends InheritedNotifier<AppLanguageController> {
  const AppLanguageScope({
    super.key,
    required AppLanguageController controller,
    required super.child,
  }) : super(notifier: controller);

  static AppLanguageController of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppLanguageScope>();
    assert(scope != null, 'AppLanguageScope is required above this widget.');
    return scope!.notifier!;
  }
}
