import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/bootstrap/app_bootstrap_controller.dart';
import 'package:tharwati_mobile/errors/global_failure_controller.dart';
import 'package:tharwati_mobile/i18n/app_language.dart';
import 'package:tharwati_mobile/widgets/global_recovery_screen.dart';

void main() {
  testWidgets('configuration error has safe Arabic rebuild guidance', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: GlobalRecoveryScreen(
          status: AppBootstrapStatus.failedConfiguration,
          language: AppLanguage.ar,
        ),
      ),
    );
    expect(find.text('إعداد التطبيق مطلوب'), findsOneWidget);
    expect(find.textContaining('أعد بناء التطبيق'), findsOneWidget);
    expect(find.textContaining('SUPABASE_'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('fatal runtime shows safe English recovery without raw details', (
    tester,
  ) async {
    const secret = 'postgres://token-secret.example/uuid-123';
    await tester.pumpWidget(
      const MaterialApp(
        home: GlobalRecoveryScreen(
          status: AppBootstrapStatus.fatalRuntime,
          language: AppLanguage.en,
        ),
      ),
    );

    expect(find.text('Unexpected application error'), findsOneWidget);
    expect(find.textContaining(secret), findsNothing);
    expect(find.textContaining('StackTrace'), findsNothing);
  });

  testWidgets('Arabic recovery uses RTL and localized actions', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: GlobalRecoveryScreen(
          status: AppBootstrapStatus.failedStartup,
          language: AppLanguage.ar,
          onRetry: () {},
        ),
      ),
    );

    expect(find.text('الاتصال غير متاح'), findsOneWidget);
    expect(find.text('إعادة المحاولة'), findsOneWidget);
    expect(
      tester
          .widget<Directionality>(find.byType(Directionality).last)
          .textDirection,
      TextDirection.rtl,
    );
  });

  test('global failure controller receives fatal handler outcomes', () {
    final controller = GlobalFailureController();
    var notifications = 0;
    controller.addListener(() => notifications++);
    controller.reportFatal();
    expect(controller.hasFatalFailure, isTrue);
    controller.retry();
    expect(controller.hasFatalFailure, isFalse);
    expect(notifications, 2);
  });

  test('main installs framework, platform and zone error routing', () {
    final source = File('lib/main.dart').readAsStringSync();
    expect(source, contains('runZonedGuarded('));
    expect(source, contains('FlutterError.onError ='));
    expect(source, contains('PlatformDispatcher.instance.onError ='));
    expect(source, contains('failureController.reportFatal()'));
    expect(source, isNot(contains('details.exception.toString()')));
  });
}
