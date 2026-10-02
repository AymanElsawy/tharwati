import 'dart:async';
import 'dart:io';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:http/http.dart' as http;
import 'package:http/io_client.dart';
import 'package:tharwati_mobile/auth/auth_recovery_coordinator.dart';
import 'package:tharwati_mobile/auth/auth_service.dart';
import 'package:tharwati_mobile/main.dart';
import 'package:tharwati_mobile/i18n/app_language.dart';
import 'package:tharwati_mobile/theme/app_theme_controller.dart';
import 'package:tharwati_mobile/auth/recovery_marker_store.dart';
import 'package:tharwati_mobile/auth/reset_password_page.dart';
import 'package:tharwati_mobile/auth/forgot_password_page.dart';

class _NativeHttp extends HttpOverrides {}

class _PkceMemory extends GotrueAsyncStorage {
  final values = <String, String>{};
  @override
  Future<String?> getItem({required String key}) async => values[key];
  @override
  Future<void> setItem({required String key, required String value}) async {
    values[key] = value;
  }

  @override
  Future<void> removeItem({required String key}) async {
    values.remove(key);
  }
}

class _Auth implements RecoveryAuthClient {
  final events = StreamController<AuthChangeEvent>.broadcast(sync: true);
  @override
  bool get hasRecoveryOrigin => false;
  @override
  Stream<AuthChangeEvent> get authEvents => events.stream;
  @override
  Future<bool> exchangeAuthCallback(Uri uri) async {
    events.add(AuthChangeEvent.passwordRecovery);
    return true;
  }

  @override
  Future<bool> validateRecoverySession() async => true;
  @override
  Future<void> clearRecoverySession() async {}
}

void main() {
  test(
    'real local Mailpit PKCE exchange retains recovery session, event and marker',
    () async {
      // Opt-in: touches only the existing dedicated local synthetic smoke user.
      // No credentials, links, verifier, or session tokens are written by this test.
      final root = Directory('../../mobile-development.local');
      final status =
          jsonDecode(File('${root.path}/status.json').readAsStringSync())
              as Map<String, dynamic>;
      final credentials =
          jsonDecode(File('${root.path}/smoke-user.json').readAsStringSync())
              as Map<String, dynamic>;
      const base = 'http://127.0.0.1:58321';
      expect(status['API_URL'], base);
      final network = IOClient(_NativeHttp().createHttpClient(null));
      final pkce = _PkceMemory();
      final client = SupabaseClient(
        base,
        status['PUBLISHABLE_KEY'] as String,
        httpClient: network,
        authOptions: AuthClientOptions(
          autoRefreshToken: false,
          pkceAsyncStorage: pkce,
        ),
      );
      authService = AuthService(client, projectUrl: base);
      final marker = MemoryRecoveryMarkerStore();
      final flow = AuthRecoveryCoordinator(authService, store: marker);
      final links = StreamController<Uri>.broadcast(sync: true);
      final events = <AuthChangeEvent>[];
      final subscription = client.auth.onAuthStateChange.listen(
        (state) => events.add(state.event),
      );
      await flow.start(initialUri: null, linkStream: links.stream);
      {
        const inbox = 'http://127.0.0.1:58324';
        Future<List<dynamic>> messages() async =>
            (jsonDecode(
                      (await network.get(
                        Uri.parse('$inbox/api/v1/messages'),
                      )).body,
                    )
                    as Map<String, dynamic>)['messages']
                as List<dynamic>;
        final oldIds = (await messages()).map((m) => m['ID']).toSet();
        await authService.requestPasswordReset(credentials['email'] as String);
        Map<String, dynamic>? mail;
        for (var attempt = 0; attempt < 30 && mail == null; attempt++) {
          final fresh = (await messages()).where(
            (m) => !oldIds.contains(m['ID']),
          );
          if (fresh.isNotEmpty) {
            mail =
                jsonDecode(
                      (await network.get(
                        Uri.parse('$inbox/api/v1/message/${fresh.first['ID']}'),
                      )).body,
                    )
                    as Map<String, dynamic>;
          } else {
            await Future<void>.delayed(const Duration(milliseconds: 100));
          }
        }
        if (mail == null) throw StateError('No fresh local recovery email');
        final match = RegExp(
          r'href="([^"]+/auth/v1/verify\?[^"]+)"',
        ).firstMatch(mail['HTML'] as String);
        if (match == null) throw StateError('No local verification URL');
        final verification = Uri.parse(
          match.group(1)!.replaceAll('&amp;', '&'),
        );
        if (![
              '127.0.0.1',
              'localhost',
              '10.0.2.2',
            ].contains(verification.host) ||
            verification.port != 58321) {
          throw StateError('Refusing non-dedicated verification URL');
        }
        final response = await network.send(
          http.Request('GET', verification.replace(host: '127.0.0.1'))
            ..followRedirects = false,
        );
        if (![302, 303].contains(response.statusCode)) {
          throw StateError(
            'Local verify did not redirect (${response.statusCode})',
          );
        }
        await response.stream.drain<void>();
        final callback = Uri.parse(response.headers['location']!);
        if (callback.scheme != 'tharwati' ||
            callback.host != 'auth-callback' ||
            !callback.queryParameters.containsKey('code')) {
          throw StateError('Expected local PKCE callback');
        }
        links.add(callback); // Real SDK exchange and PASSWORD_RECOVERY stream.
        for (var attempt = 0; attempt < 100 && !flow.isActive; attempt++) {
          await Future<void>.delayed(const Duration(milliseconds: 50));
        }
      }
      expect(flow.status, AuthRecoveryStatus.active);
      expect(marker.phase, 'active');
      expect(events, contains(AuthChangeEvent.passwordRecovery));
      expect(client.auth.currentSession, isNotNull);
      await flow.cancel();
      expect(flow.requiresFreshLogin, isTrue);
      flow.dispose();
      await subscription.cancel();
      await links.close();
      await client.dispose();
      network.close();
    },
    skip: !const bool.fromEnvironment('THARWATI_LOCAL_RECOVERY_INTEGRATION'),
  );

  testWidgets(
    'successful SDK event-before-return replaces Forgot Password in the real app root',
    (tester) async {
      final client = (await tester.runAsync(
        () async =>
            SupabaseClient('http://127.0.0.1:58321', 'sb_publishable_test'),
      ))!;
      authService = AuthService(client, projectUrl: 'http://127.0.0.1:58321');
      final sdkSequence = _Auth();
      final marker = MemoryRecoveryMarkerStore();
      final flow = AuthRecoveryCoordinator(sdkSequence, store: marker);
      final links = StreamController<Uri>.broadcast(sync: true);
      await flow.start(initialUri: null, linkStream: links.stream);
      final language = AppLanguageController();
      final theme = AppThemeController();
      await tester.pumpWidget(
        TharwatiApp(
          recoveryCoordinator: flow,
          languageController: language,
          themeController: theme,
        ),
      );
      await tester.pumpAndSettle();
      Navigator.of(tester.element(find.byType(Scaffold).first)).push(
        MaterialPageRoute<void>(builder: (_) => const ForgotPasswordPage()),
      );
      await tester.pumpAndSettle();
      links.add(
        Uri.parse('tharwati://auth-callback?code=successful-callback-123456'),
      );
      await tester.pumpAndSettle();
      expect(marker.phase, 'active');
      expect(find.byType(ResetPasswordPage), findsOneWidget);
      expect(find.byType(ForgotPasswordPage), findsNothing);
      expect(tester.takeException(), isNull);
      await flow.cancel();
      await tester.pumpAndSettle();
      expect(flow.requiresFreshLogin, isTrue);
      await tester.pumpWidget(const SizedBox.shrink());
      language.dispose();
      theme.dispose();
      await links.close();
      await sdkSequence.events.close();
      await tester.runAsync(client.dispose);
    },
  );

  testWidgets(
    'diagnoses competing Flutter navigation before app_links exchange',
    (tester) async {
      final client = (await tester.runAsync(
        () async =>
            SupabaseClient('http://127.0.0.1:58321', 'sb_publishable_test'),
      ))!;
      authService = AuthService(client, projectUrl: 'http://127.0.0.1:58321');
      final flow = AuthRecoveryCoordinator(_Auth());
      await flow.start(initialUri: null, linkStream: const Stream.empty());
      final language = AppLanguageController();
      final theme = AppThemeController();
      await tester.pumpWidget(
        TharwatiApp(
          recoveryCoordinator: flow,
          languageController: language,
          themeController: theme,
        ),
      );
      await tester.pumpAndSettle();
      // Android's built-in Flutter handler delivers this in addition to app_links.
      // It strips scheme/host and attempts to push a named route the app lacks.
      final router =
          tester.state(find.byType(WidgetsApp)) as WidgetsBindingObserver;
      await expectLater(
        router.didPushRouteInformation(
          RouteInformation(
            uri: Uri.parse(
              'tharwati://auth-callback?code=diagnostic-valid-code-123456',
            ),
          ),
        ),
        throwsA(
          isA<FlutterError>().having(
            (e) => e.toString(),
            'message',
            contains('Could not find a generator for route'),
          ),
        ),
      );
      await tester.pumpWidget(const SizedBox.shrink());
      language.dispose();
      theme.dispose();
      await tester.runAsync(client.dispose);
    },
  );

  test('Android delivers Auth callbacks exclusively through app_links', () {
    final manifest = File(
      'android/app/src/main/AndroidManifest.xml',
    ).readAsStringSync();
    expect(
      manifest,
      matches(
        RegExp(
          r'android:name="flutter_deeplinking_enabled"\s+android:value="false"',
        ),
      ),
    );
  });
}
