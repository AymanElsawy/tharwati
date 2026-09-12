import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/i18n/app_language.dart';
import 'package:tharwati_mobile/settings/settings_page.dart';
import 'package:tharwati_mobile/settings/settings_profile_repository.dart';
import 'package:tharwati_mobile/theme/app_theme.dart';
import 'package:tharwati_mobile/theme/app_theme_controller.dart';

void main() {
  testWidgets('loads, saves the canonical name, and shows session email', (
    tester,
  ) async {
    final store = _FakeProfileStore('Ada Lovelace');
    final languageController = AppLanguageController(
      store: _MemoryLanguageStore(),
    );
    final themeController = AppThemeController(store: _MemoryThemeStore());
    var signedOut = false;

    await tester.pumpWidget(
      _SettingsTestHost(
        languageController: languageController,
        themeController: themeController,
        child: SettingsPage(
          email: 'investor@example.com',
          profileStore: store,
          onSignOut: () async => signedOut = true,
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Ada Lovelace'), findsOneWidget);
    expect(find.text('investor@example.com'), findsOneWidget);
    expect(find.text('Sign out'), findsOneWidget);
    expect(find.text('Language'), findsOneWidget);
    expect(find.text('English'), findsWidgets);
    expect(find.text('Appearance'), findsOneWidget);
    expect(find.text('Light'), findsWidgets);

    await tester.enterText(find.byType(TextField), '  Grace Hopper  ');
    await tester.tap(find.text('Save changes'));
    await tester.pump();

    expect(store.savedName, '  Grace Hopper  ');
    expect(find.text('Profile updated.'), findsOneWidget);

    await tester.tap(find.text('العربية'));
    await tester.pumpAndSettle();
    expect(languageController.language, AppLanguage.ar);
    expect(
      tester
          .widget<Directionality>(find.byKey(const Key('app-direction')))
          .textDirection,
      TextDirection.rtl,
    );

    final signOut = find.text('تسجيل الخروج');
    await tester.ensureVisible(signOut);
    await tester.tap(signOut);
    await tester.pump();
    expect(signedOut, isTrue);
  });

  testWidgets('switches the shared appearance preference immediately', (
    tester,
  ) async {
    final languageController = AppLanguageController(
      store: _MemoryLanguageStore(),
    );
    final themeController = AppThemeController(store: _MemoryThemeStore());

    await tester.pumpWidget(
      _SettingsTestHost(
        languageController: languageController,
        themeController: themeController,
        child: SettingsPage(
          email: 'investor@example.com',
          profileStore: _FakeProfileStore('Ada Lovelace'),
        ),
      ),
    );
    await tester.pump();

    final dark = find.text('Dark').last;
    await tester.ensureVisible(dark);
    await tester.tap(dark);
    await tester.pumpAndSettle();

    expect(themeController.themeMode, ThemeMode.dark);
    expect(
      tester.widget<MaterialApp>(find.byType(MaterialApp)).themeMode,
      ThemeMode.dark,
    );
  });
}

class _SettingsTestHost extends StatelessWidget {
  const _SettingsTestHost({
    required this.languageController,
    required this.themeController,
    required this.child,
  });

  final AppLanguageController languageController;
  final AppThemeController themeController;
  final Widget child;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: Listenable.merge([languageController, themeController]),
    builder: (context, _) => MaterialApp(
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: themeController.themeMode,
      locale: languageController.language.locale,
      supportedLocales: AppLanguage.values.map((language) => language.locale),
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: AppThemeScope(
        controller: themeController,
        child: AppLanguageScope(
          controller: languageController,
          child: Directionality(
            key: const Key('app-direction'),
            textDirection: languageController.language.direction,
            child: child,
          ),
        ),
      ),
    ),
  );
}

class _FakeProfileStore implements SettingsProfileStore {
  _FakeProfileStore(this.fullName);

  String? fullName;
  String? savedName;

  @override
  Future<String?> loadFullName() async => fullName;

  @override
  Future<String?> updateFullName(String value) async {
    savedName = value;
    fullName = normalizeFullName(value);
    return fullName;
  }
}

class _MemoryLanguageStore implements LanguageStore {
  @override
  Future<String?> readLanguage() async => null;

  @override
  Future<void> writeLanguage(String code) async {}
}

class _MemoryThemeStore implements ThemeStore {
  @override
  Future<String?> readTheme() async => null;

  @override
  Future<void> writeTheme(String code) async {}
}
