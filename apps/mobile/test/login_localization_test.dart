import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/auth/login_page.dart';
import 'package:tharwati_mobile/i18n/app_language.dart';
import 'package:tharwati_mobile/theme/app_theme.dart';

void main() {
  testWidgets('switches Login copy and direction before authentication', (
    tester,
  ) async {
    final controller = AppLanguageController(store: _MemoryLanguageStore());

    await tester.pumpWidget(_LanguageTestHost(controller: controller));

    expect(find.text('Sign in'), findsOneWidget);
    expect(find.text('EGP'), findsNothing);
    expect(find.byTooltip('Show password'), findsOneWidget);
    expect(
      tester
          .widget<EditableText>(find.byType(EditableText).first)
          .textDirection,
      TextDirection.ltr,
    );
    expect(
      tester
          .widget<Directionality>(find.byKey(const Key('app-direction')))
          .textDirection,
      TextDirection.ltr,
    );

    await tester.tap(find.text('العربية'));
    await tester.pump();

    expect(find.text('تسجيل الدخول'), findsOneWidget);
    expect(find.text('البريد الإلكتروني'), findsOneWidget);
    expect(find.byTooltip('إظهار كلمة المرور'), findsOneWidget);
    expect(
      tester
          .widget<EditableText>(find.byType(EditableText).first)
          .textDirection,
      TextDirection.ltr,
    );
    expect(
      tester
          .widget<Directionality>(find.byKey(const Key('app-direction')))
          .textDirection,
      TextDirection.rtl,
    );
  });
}

class _LanguageTestHost extends StatelessWidget {
  const _LanguageTestHost({required this.controller});

  final AppLanguageController controller;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: controller,
    builder: (context, _) => MaterialApp(
      theme: AppTheme.light(),
      locale: controller.language.locale,
      supportedLocales: AppLanguage.values.map((language) => language.locale),
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: AppLanguageScope(
        controller: controller,
        child: Directionality(
          key: const Key('app-direction'),
          textDirection: controller.language.direction,
          child: const LoginPage(),
        ),
      ),
    ),
  );
}

class _MemoryLanguageStore implements LanguageStore {
  @override
  Future<String?> readLanguage() async => null;

  @override
  Future<void> writeLanguage(String code) async {}
}
