import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/i18n/app_language.dart';
import 'package:tharwati_mobile/settings/account_deletion_controller.dart';
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

    await tester.drag(find.byType(CustomScrollView), const Offset(0, -800));
    await tester.pumpAndSettle();
    final signOut = find.text('تسجيل الخروج');
    expect(signOut, findsOneWidget);
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

    await tester.drag(find.byType(CustomScrollView), const Offset(0, -500));
    await tester.pumpAndSettle();
    final dark = find.text('Dark').last;
    await tester.tap(dark);
    await tester.pumpAndSettle();

    expect(themeController.themeMode, ThemeMode.dark);
    expect(
      tester.widget<MaterialApp>(find.byType(MaterialApp)).themeMode,
      ThemeMode.dark,
    );
  });

  testWidgets('Arabic Settings remains scroll-safe on a compact viewport', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(412, 680);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final languageController = AppLanguageController(
      store: _MemoryLanguageStore(),
    );
    await languageController.setLanguage(AppLanguage.ar);
    final themeController = AppThemeController(store: _MemoryThemeStore());

    await tester.pumpWidget(
      _SettingsTestHost(
        languageController: languageController,
        themeController: themeController,
        child: SettingsPage(
          email: 'investor@example.com',
          profileStore: _FakeProfileStore('مستخدم تجريبي'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(CustomScrollView), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.drag(find.byType(CustomScrollView), const Offset(0, -1000));
    await tester.pumpAndSettle();
    expect(find.text('تسجيل الخروج'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'delete flow requires exact email and cancel clears credentials',
    (tester) async {
      final gateway = _DeletionGateway();
      final exit = _DeletionExit();
      await tester.pumpWidget(
        _SettingsTestHost(
          languageController: AppLanguageController(
            store: _MemoryLanguageStore(),
          ),
          themeController: AppThemeController(store: _MemoryThemeStore()),
          child: SettingsPage(
            email: 'investor@example.com',
            profileStore: _FakeProfileStore('Ada'),
            deletionGateway: gateway,
            deletionExit: exit,
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.drag(find.byType(CustomScrollView), const Offset(0, -900));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('open-delete-account')));
      await tester.pumpAndSettle();

      expect(find.text('Permanently delete account?'), findsOneWidget);
      await tester.enterText(
        find.byKey(const Key('delete-password')),
        'correct-password',
      );
      await tester.tap(find.text('Continue'));
      await tester.pumpAndSettle();
      expect(gateway.reauthCalls, 1);

      await tester.enterText(
        find.byKey(const Key('delete-email-confirmation')),
        'INVESTOR@example.com',
      );
      final deleteButton = tester.widget<FilledButton>(
        find.widgetWithText(FilledButton, 'Delete account'),
      );
      expect(deleteButton.onPressed, isNull);

      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(find.byType(AlertDialog), findsNothing);

      await tester.tap(find.byKey(const Key('open-delete-account')));
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<TextField>(find.byKey(const Key('delete-password')))
            .controller!
            .text,
        isEmpty,
      );
    },
  );

  testWidgets('Arabic destructive flow is RTL and compact-layout safe', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final language = AppLanguageController(store: _MemoryLanguageStore());
    await language.setLanguage(AppLanguage.ar);

    await tester.pumpWidget(
      _SettingsTestHost(
        languageController: language,
        themeController: AppThemeController(store: _MemoryThemeStore()),
        child: SettingsPage(
          email: 'investor@example.com',
          profileStore: _FakeProfileStore('مستخدم تجريبي'),
          deletionGateway: _DeletionGateway(),
          deletionExit: _DeletionExit(),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.drag(find.byType(CustomScrollView), const Offset(0, -1200));
    await tester.pumpAndSettle();
    expect(find.text('منطقة الخطر'), findsOneWidget);
    await tester.tap(find.byKey(const Key('open-delete-account')));
    await tester.pumpAndSettle();

    expect(find.text('حذف الحساب نهائيًا؟'), findsOneWidget);
    expect(
      tester
          .widget<Directionality>(find.byKey(const Key('app-direction')))
          .textDirection,
      TextDirection.rtl,
    );
    expect(tester.takeException(), isNull);
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

class _DeletionExit implements AccountDeletionExit {
  @override
  void forceSignedOut() {}
}

class _DeletionGateway implements AccountDeletionGateway {
  int reauthCalls = 0;

  @override
  Future<void> reauthenticate(String password) async => reauthCalls++;

  @override
  Future<void> deleteCurrentAccount(String password) async {}

  @override
  Future<void> clearLocalSession() async {}
}
