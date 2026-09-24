import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:tharwati_mobile/auth/auth_recovery_coordinator.dart';
import 'package:tharwati_mobile/auth/auth_service.dart';
import 'package:tharwati_mobile/bootstrap/app_bootstrap_controller.dart';
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
