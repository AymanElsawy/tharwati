import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:tharwati_mobile/auth/auth_recovery_coordinator.dart';
import 'package:tharwati_mobile/auth/recovery_gate.dart';
import 'package:tharwati_mobile/auth/reset_password_page.dart';
import 'package:tharwati_mobile/auth/forgot_password_page.dart';
import 'package:tharwati_mobile/i18n/app_language.dart';
import 'package:tharwati_mobile/i18n/recovery_copy.dart';
import 'package:tharwati_mobile/theme/app_theme.dart';

class _Auth implements RecoveryAuthClient {
  @override
  bool get hasRecoveryOrigin => false;
  @override
  Stream<AuthChangeEvent> get authEvents => const Stream.empty();
  @override
  Future<bool> exchangeAuthCallback(Uri uri) async => true;
  @override
  Future<bool> validateRecoverySession() async => true;
  @override
  Future<void> clearRecoverySession() async {}
}

class _Language implements LanguageStore {
  _Language(this.code);
  final String code;
  @override
  Future<String?> readLanguage() async => code;
  @override
  Future<void> writeLanguage(String code) async {}
}

void main() {
  testWidgets(
    'warm recovery replaces pushed Forgot Password and cancel returns to Login',
    (tester) async {
      final links = StreamController<Uri>.broadcast();
      final flow = AuthRecoveryCoordinator(_Auth());
      await flow.start(initialUri: null, linkStream: links.stream);
      final navigator = GlobalKey<NavigatorState>();
      final locale = AppLanguageController(store: _Language('en'));
      await tester.pumpWidget(
        ListenableBuilder(
          listenable: flow,
          builder: (_, _) => MaterialApp(
            navigatorKey: navigator,
            theme: AppTheme.light(),
            builder: (_, child) => AppLanguageScope(
              controller: locale,
              child: RecoveryGate(
                coordinator: flow,
                onRequestNewLink: flow.cancel,
                child: child!,
              ),
            ),
            home: const Scaffold(body: Text('Login root')),
          ),
        ),
      );
      navigator.currentState!.push(
        MaterialPageRoute<void>(builder: (_) => const ForgotPasswordPage()),
      );
      await tester.pumpAndSettle();
      expect(find.byType(ForgotPasswordPage), findsOneWidget);
      links.add(
        Uri.parse('tharwati://auth-callback?code=warm-valid-code-123456'),
      );
      await tester.pumpAndSettle();
      expect(find.text('Choose a new password'), findsOneWidget);
      expect(find.byType(ForgotPasswordPage), findsNothing);
      await tester.tap(find.text('Cancel recovery'));
      await tester.pumpAndSettle();
      expect(find.text('Login root'), findsOneWidget);
      expect(find.byType(ForgotPasswordPage), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
      flow.dispose();
      locale.dispose();
      await links.close();
    },
  );

  testWidgets(
    'successful reset ends the gate and returns to Login automatically',
    (tester) async {
      final flow = AuthRecoveryCoordinator(_Auth());
      await flow.start(
        initialUri: Uri.parse(
          'tharwati://auth-callback?code=cold-valid-code-123456',
        ),
        linkStream: const Stream.empty(),
      );
      var updates = 0;
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          builder: (_, child) => RecoveryGate(
            coordinator: flow,
            onRequestNewLink: flow.cancel,
            activeBuilder: (_) => ResetPasswordPage(
              updatePassword: (_) async {
                updates++;
              },
              onRecoveryFinished: flow.complete,
              onRecoveryCancelled: flow.cancel,
            ),
            child: child!,
          ),
          home: const Scaffold(body: Text('Login root')),
        ),
      );
      await tester.enterText(find.byType(TextFormField).at(0), 'Password1234');
      await tester.enterText(find.byType(TextFormField).at(1), 'Password1234');
      await tester.tap(find.text('Save new password'));
      await tester.pumpAndSettle();
      expect(updates, 1);
      expect(flow.requiresFreshLogin, isTrue);
      expect(find.text('Login root'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
      flow.dispose();
    },
  );

  for (final language in AppLanguage.values) {
    testWidgets(
      '${language.code} invalid link feedback and request-new-link action',
      (tester) async {
        final flow = AuthRecoveryCoordinator(_Auth());
        await flow.start(
          initialUri: Uri.parse('tharwati://auth-callback'),
          linkStream: const Stream.empty(),
        );
        final locale = AppLanguageController(store: _Language(language.code));
        await locale.load();
        var requests = 0;
        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.light(),
            builder: (_, child) => AppLanguageScope(
              controller: locale,
              child: RecoveryGate(
                coordinator: flow,
                child: child!,
                onRequestNewLink: () async {
                  requests++;
                  await flow.cancel();
                },
              ),
            ),
            home: const Scaffold(body: Text('Login root')),
          ),
        );
        final copy = RecoveryCopy.of(language);
        expect(find.text(copy.invalidLink), findsOneWidget);
        await tester.tap(find.text(copy.requestNewLink));
        await tester.pumpAndSettle();
        expect(requests, 1);
        expect(find.text('Login root'), findsOneWidget);
        await tester.pumpWidget(const SizedBox.shrink());
        flow.dispose();
        locale.dispose();
      },
    );
  }
}
