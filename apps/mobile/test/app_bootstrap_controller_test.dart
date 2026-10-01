import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:tharwati_mobile/auth/auth_recovery_coordinator.dart';
import 'package:tharwati_mobile/auth/auth_service.dart';
import 'package:tharwati_mobile/bootstrap/app_bootstrap_controller.dart';
import 'package:tharwati_mobile/bootstrap/bootstrap_app.dart';
import 'package:tharwati_mobile/env.dart';
import 'package:tharwati_mobile/errors/global_failure_controller.dart';
import 'package:tharwati_mobile/i18n/app_language.dart';
import 'package:tharwati_mobile/theme/app_theme_controller.dart';

class _RecoveryClient implements RecoveryAuthClient {
  @override
  Stream<AuthChangeEvent> get authEvents => const Stream.empty();

  @override
  Future<bool> exchangeAuthCallback(Uri uri) async => false;
}

class _RecoveryCoordinator extends AuthRecoveryCoordinator {
  _RecoveryCoordinator() : super(_RecoveryClient());

  int starts = 0;
  bool fail = false;

  @override
  Future<void> start({
    required Uri? initialUri,
    required Stream<Uri> linkStream,
  }) async {
    starts++;
    if (fail) throw StateError('private recovery failure');
  }
}

class _Platform implements AppBootstrapPlatform {
  _Platform({this.configuration});

  final MobileEnvironmentConfig? configuration;
  bool configurationValid = true;
  bool failInitialize = false;
  int validations = 0;
  int initialUriReads = 0;
  int initializations = 0;
  Completer<void>? initializationCompleter;
  final recovery = _RecoveryCoordinator();
  late final AuthService service = AuthService(
    SupabaseClient('https://example.supabase.co', 'sb_publishable_test'),
  );

  @override
  void validateConfiguration() {
    validations++;
    if (configuration != null) {
      DefaultAppBootstrapPlatform(
        configuration: configuration!,
      ).validateConfiguration();
    }
    if (!configurationValid) throw const FormatException('private key detail');
  }

  @override
  Future<Uri?> readInitialUri() async {
    initialUriReads++;
    return null;
  }

  @override
  Stream<Uri> get linkStream => const Stream.empty();

  @override
  Future<void> initializeSupabase() async {
    initializations++;
    if (failInitialize) throw StateError('private connection detail');
    await initializationCompleter?.future;
  }

  @override
  AuthService createAuthService() => service;

  @override
  AuthRecoveryCoordinator createRecoveryCoordinator(AuthService service) =>
      recovery;
}

class _ThemeStore implements ThemeStore {
  _ThemeStore({this.fail = false});
  final bool fail;

  @override
  Future<String?> readTheme() async {
    if (fail) throw StateError('private storage detail');
    return null;
  }

  @override
  Future<void> writeTheme(String code) async {}
}

class _LanguageStore implements LanguageStore {
  _LanguageStore({this.fail = false});
  final bool fail;

  @override
  Future<String?> readLanguage() async {
    if (fail) throw StateError('private storage detail');
    return null;
  }

  @override
  Future<void> writeLanguage(String code) async {}
}

AppBootstrapController _controller(_Platform platform) =>
    AppBootstrapController(
      platform: platform,
      themeController: AppThemeController(store: _ThemeStore()),
      languageController: AppLanguageController(store: _LanguageStore()),
    );

void main() {
  for (final config in [
    const MobileEnvironmentConfig(
      environmentName: 'staging',
      supabaseUrl: 'https://production.example.supabase.co',
      supabasePublishableKey: 'sb_publishable_production_test',
    ),
    const MobileEnvironmentConfig(
      environmentName: 'production',
      supabaseUrl: 'not-a-url',
      supabasePublishableKey: 'sb_publishable_production_test',
    ),
    const MobileEnvironmentConfig(
      environmentName: 'production',
      supabaseUrl: 'https://production.example.supabase.co',
      supabasePublishableKey: 'sb_secret_invalid_fixture',
    ),
  ]) {
    test('invalid configuration stops before backend initialization', () async {
      final platform = _Platform(configuration: config);
      final controller = _controller(platform);
      await controller.start();
      await controller.retry();
      expect(controller.status, AppBootstrapStatus.failedConfiguration);
      expect(platform.initialUriReads, 0);
      expect(platform.initializations, 0);
      expect(platform.recovery.starts, 0);
      expect(controller.authService, isNull);
      controller.dispose();
    });
  }

  for (final missing in ['environment', 'url', 'key', 'all']) {
    test(
      'missing $missing stops before any backend or callback work',
      () async {
        final config = MobileEnvironmentConfig(
          environmentName: missing == 'environment' || missing == 'all'
              ? ''
              : 'production',
          supabaseUrl: missing == 'url' || missing == 'all'
              ? ''
              : 'https://production.example.supabase.co',
          supabasePublishableKey: missing == 'key' || missing == 'all'
              ? ''
              : 'sb_publishable_production_test',
        );
        final platform = _Platform(configuration: config);
        final controller = _controller(platform);
        await controller.start();
        await controller.retry();
        expect(controller.status, AppBootstrapStatus.failedConfiguration);
        expect(platform.initialUriReads, 0);
        expect(platform.initializations, 0);
        expect(platform.recovery.starts, 0);
        expect(controller.authService, isNull);
        expect(controller.canSignOut, isFalse);
        controller.dispose();
      },
    );
  }

  testWidgets('unconfigured build renders controlled UI without backend work', (
    tester,
  ) async {
    // These are the actual compiled defaults, not a mocked validation failure.
    expect(Env.environmentName, isEmpty);
    expect(Env.supabaseUrl, isEmpty);
    expect(Env.supabasePublishableKey, isEmpty);
    final platform = _Platform(configuration: Env.configuration);
    await tester.pumpWidget(
      BootstrapApp(
        controller: _controller(platform),
        failureController: GlobalFailureController(),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('App configuration required'), findsOneWidget);
    expect(find.textContaining('Rebuild the app'), findsOneWidget);
    expect(find.text('Sign out'), findsNothing);
    expect(find.textContaining('supabase.co'), findsNothing);
    expect(find.textContaining('sb_publishable_'), findsNothing);
    expect(tester.takeException(), isNull);
    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();
    expect(find.text('App configuration required'), findsOneWidget);
    expect(platform.initialUriReads, 0);
    expect(platform.initializations, 0);
    expect(platform.recovery.starts, 0);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  test('invalid configuration becomes recoverable after runApp', () async {
    final platform = _Platform()..configurationValid = false;
    final controller = _controller(platform);

    await controller.start();
    expect(controller.status, AppBootstrapStatus.failedConfiguration);
    expect(platform.initializations, 0);

    platform.configurationValid = true;
    await controller.retry();
    expect(controller.status, AppBootstrapStatus.ready);
    expect(platform.validations, 2);
  });

  test(
    'startup retry preserves completed stages and does not sign out',
    () async {
      final platform = _Platform()..recovery.fail = true;
      final controller = _controller(platform);

      await controller.start();
      expect(controller.status, AppBootstrapStatus.failedStartup);
      expect(platform.initialUriReads, 1);
      expect(platform.initializations, 1);
      expect(platform.recovery.starts, 1);
      expect(controller.canSignOut, isFalse);

      platform.recovery.fail = false;
      await controller.retry();
      expect(controller.status, AppBootstrapStatus.ready);
      expect(platform.initialUriReads, 1);
      expect(platform.initializations, 1);
      expect(platform.recovery.starts, 2);
    },
  );

  test('concurrent retries coalesce into one initialization', () async {
    final platform = _Platform()..initializationCompleter = Completer<void>();
    final controller = _controller(platform);

    final first = controller.start();
    final second = controller.retry();
    expect(identical(first, second), isTrue);
    await Future<void>.delayed(Duration.zero);
    expect(platform.initializations, 1);
    platform.initializationCompleter!.complete();
    await first;
    expect(controller.status, AppBootstrapStatus.ready);
  });

  test('optional preference failures use defaults and continue', () async {
    final controller = AppBootstrapController(
      platform: _Platform(),
      themeController: AppThemeController(store: _ThemeStore(fail: true)),
      languageController: AppLanguageController(
        store: _LanguageStore(fail: true),
      ),
    );

    await controller.start();
    expect(controller.status, AppBootstrapStatus.ready);
    expect(controller.themeController.themeMode, ThemeMode.light);
    expect(controller.languageController.language, AppLanguage.en);
  });

  test(
    'Supabase startup failure shows fallback without repeating earlier work',
    () async {
      final platform = _Platform()..failInitialize = true;
      final controller = _controller(platform);

      await controller.start();
      expect(controller.status, AppBootstrapStatus.failedStartup);
      expect(platform.initialUriReads, 1);

      platform.failInitialize = false;
      await controller.retry();
      expect(controller.status, AppBootstrapStatus.ready);
      expect(platform.initialUriReads, 1);
      expect(platform.initializations, 2);
    },
  );
}
