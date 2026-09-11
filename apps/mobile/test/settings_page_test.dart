import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/i18n/app_language.dart';
import 'package:tharwati_mobile/settings/settings_page.dart';
import 'package:tharwati_mobile/settings/settings_profile_repository.dart';
import 'package:tharwati_mobile/theme/app_theme.dart';

void main() {
  testWidgets('loads, saves the canonical name, and shows session email', (
    tester,
  ) async {
    final store = _FakeProfileStore('Ada Lovelace');
    final languageController = AppLanguageController(
      store: _MemoryLanguageStore(),
    );
    var signedOut = false;

    await tester.pumpWidget(
      _SettingsTestHost(
        languageController: languageController,
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

    await tester.tap(find.text('العربية'));
    await tester.pump();
    expect(languageController.language, AppLanguage.ar);
    expect(
      tester
          .widget<Directionality>(find.byKey(const Key('app-direction')))
          .textDirection,
      TextDirection.rtl,
    );

    await tester.enterText(find.byType(TextField), '  Grace Hopper  ');
    await tester.tap(find.text('حفظ التغييرات'));
    await tester.pump();

    expect(store.savedName, '  Grace Hopper  ');
    expect(find.text('تم تحديث الملف الشخصي.'), findsOneWidget);

    final signOut = find.text('تسجيل الخروج');
    await tester.ensureVisible(signOut);
    await tester.tap(signOut);
    await tester.pump();
    expect(signedOut, isTrue);
  });
}

class _SettingsTestHost extends StatelessWidget {
  const _SettingsTestHost({
    required this.languageController,
    required this.child,
  });

  final AppLanguageController languageController;
  final Widget child;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: languageController,
    builder: (context, _) => MaterialApp(
      theme: AppTheme.light(),
      locale: languageController.language.locale,
      supportedLocales: AppLanguage.values.map((language) => language.locale),
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: AppLanguageScope(
        controller: languageController,
        child: Directionality(
          key: const Key('app-direction'),
          textDirection: languageController.language.direction,
          child: child,
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
