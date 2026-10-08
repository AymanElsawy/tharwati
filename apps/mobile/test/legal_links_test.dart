import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:tharwati_mobile/auth/signup_page.dart';
import 'package:tharwati_mobile/i18n/app_language.dart';
import 'package:tharwati_mobile/legal/legal_link.dart';
import 'package:tharwati_mobile/settings/settings_page.dart';
import 'package:tharwati_mobile/settings/settings_profile_repository.dart';
import 'package:tharwati_mobile/theme/app_theme.dart';
import 'package:tharwati_mobile/theme/app_theme_controller.dart';
import 'package:url_launcher_platform_interface/url_launcher_platform_interface.dart';
import 'package:url_launcher_platform_interface/link.dart';

void main() {
  GoogleFonts.config.allowRuntimeFetching = false;
  late _Launcher launcher;
  late UrlLauncherPlatform original;
  setUp(() {
    original = UrlLauncherPlatform.instance;
    launcher = _Launcher();
    UrlLauncherPlatform.instance = launcher;
  });
  tearDown(() => UrlLauncherPlatform.instance = original);

  for (final language in AppLanguage.values) {
    for (final signup in [true, false]) {
      testWidgets(
        '${signup ? 'Signup' : 'Settings'} opens legal URLs externally in ${language.code}',
        (tester) async {
          tester.view.physicalSize = const Size(420, 1500);
          tester.view.devicePixelRatio = 1;
          addTearDown(tester.view.resetPhysicalSize);
          addTearDown(tester.view.resetDevicePixelRatio);
          final controller = AppLanguageController(store: _LanguageStore());
          await controller.setLanguage(language);
          await tester.pumpWidget(
            _host(
              controller,
              signup
                  ? const SignUpPage()
                  : SettingsPage(
                      email: 'ada@example.com',
                      profileStore: _ProfileStore(),
                    ),
            ),
          );
          await tester.pumpAndSettle();
          for (final document in LegalDocument.values) {
            final link = find.byKey(Key('legal-${document.name}'));
            await tester.ensureVisible(link);
            await tester.pumpAndSettle();
            expect(find.text(legalLabel(document, language)), findsOneWidget);
            await tester.tap(link);
            await tester.pumpAndSettle();
            expect(
              launcher.urls.last,
              'https://tharwati-dgp.pages.dev/${document.name}?lang=${language.code}',
            );
            expect(
              launcher.modes.last,
              PreferredLaunchMode.externalApplication,
            );
            if (signup) {
              expect(
                tester.widget<Checkbox>(find.byType(Checkbox)).value,
                isFalse,
              );
            }
            expect(tester.takeException(), isNull);
          }
          if (signup) {
            final create = tester.widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Create account'),
            );
            expect(create.onPressed, isNull);
          }
        },
      );
    }
    testWidgets('launch failure has localized feedback in ${language.code}', (
      tester,
    ) async {
      launcher.succeeds = false;
      final controller = AppLanguageController(store: _LanguageStore());
      await controller.setLanguage(language);
      await tester.pumpWidget(
        _host(controller, const Scaffold(body: LegalLinks())),
      );
      await tester.tap(find.byKey(const Key('legal-privacy')));
      await tester.pump();
      expect(
        find.text(
          language == AppLanguage.ar
              ? 'تعذر فتح الصفحة. حاول مجددًا.'
              : 'Could not open the page. Please try again.',
        ),
        findsOneWidget,
      );
    });
  }
}

Widget _host(AppLanguageController controller, Widget child) => MaterialApp(
  theme: AppTheme.light(),
  home: AppThemeScope(
    controller: AppThemeController(),
    child: AppLanguageScope(
      controller: controller,
      child: Directionality(
        textDirection: controller.language.direction,
        child: child,
      ),
    ),
  ),
);

class _Launcher extends UrlLauncherPlatform {
  @override
  LinkDelegate? get linkDelegate => null;
  final urls = <String>[];
  final modes = <PreferredLaunchMode>[];
  bool succeeds = true;
  @override
  Future<bool> launchUrl(String url, LaunchOptions options) async {
    urls.add(url);
    modes.add(options.mode);
    return succeeds;
  }
}

class _LanguageStore implements LanguageStore {
  @override
  Future<String?> readLanguage() async => null;
  @override
  Future<void> writeLanguage(String code) async {}
}

class _ProfileStore implements SettingsProfileStore {
  @override
  Future<String?> loadFullName() async => 'Ada';
  @override
  Future<String?> updateFullName(String value) async => value;
}
