import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../auth/auth_recovery_coordinator.dart';
import '../auth/auth_service.dart';
import '../env.dart';
import '../errors/app_error_reporter.dart';
import '../i18n/app_language.dart';
import '../theme/app_theme_controller.dart';

enum AppBootstrapStatus {
  starting,
  ready,
  failedConfiguration,
  failedStartup,
  fatalRuntime,
}

abstract interface class AppBootstrapPlatform {
  void validateConfiguration();
  Future<Uri?> readInitialUri();
  Stream<Uri> get linkStream;
  Future<void> initializeSupabase();
  AuthService createAuthService();
  AuthRecoveryCoordinator createRecoveryCoordinator(AuthService service);
}

class DefaultAppBootstrapPlatform implements AppBootstrapPlatform {
  DefaultAppBootstrapPlatform() : _links = AppLinks();

  final AppLinks _links;

  @override
  void validateConfiguration() {
    final uri = Uri.tryParse(Env.supabaseUrl);
    if (uri == null ||
        uri.scheme != 'https' ||
        uri.host.isEmpty ||
        !Env.supabasePublishableKey.startsWith('sb_publishable_')) {
      throw const FormatException('invalid application configuration');
    }
  }

  @override
  Future<Uri?> readInitialUri() async {
    try {
      return await _links.getInitialLink();
    } catch (_) {
      return null;
    }
  }

  @override
  Stream<Uri> get linkStream => _links.uriLinkStream;

  @override
  Future<void> initializeSupabase() async {
    await Supabase.initialize(
      url: Env.supabaseUrl,
      publishableKey: Env.supabasePublishableKey,
      authOptions: const FlutterAuthClientOptions(detectSessionInUri: false),
    ).timeout(const Duration(seconds: 20));
  }

  @override
  AuthService createAuthService() => AuthService(Supabase.instance.client);

  @override
  AuthRecoveryCoordinator createRecoveryCoordinator(AuthService service) =>
      AuthRecoveryCoordinator(service);
}

class AppBootstrapController extends ChangeNotifier {
  AppBootstrapController({
    AppBootstrapPlatform? platform,
    AppThemeController? themeController,
    AppLanguageController? languageController,
    AppErrorReporter reporter = const NoopAppErrorReporter(),
  }) : _platform = platform ?? DefaultAppBootstrapPlatform(),
       themeController = themeController ?? AppThemeController(),
       languageController = languageController ?? AppLanguageController(),
       _reporter = reporter;

  final AppBootstrapPlatform _platform;
  final AppErrorReporter _reporter;
  final AppThemeController themeController;
  final AppLanguageController languageController;

  AppBootstrapStatus _status = AppBootstrapStatus.starting;
  Future<void>? _attempt;
  bool _configurationValid = false;
  bool _initialUriRead = false;
  bool _supabaseInitialized = false;
  bool _recoveryStarted = false;
  bool _fatalRuntime = false;
  Uri? _initialUri;
  AuthService? _authService;
  AuthRecoveryCoordinator? _recoveryCoordinator;

  AppBootstrapStatus get status => _status;
  AuthService? get authService => _authService;
  AuthRecoveryCoordinator? get recoveryCoordinator => _recoveryCoordinator;
  bool get canSignOut => _authService?.currentSession != null;

  Future<void> start() =>
      _attempt ??= _run().whenComplete(() => _attempt = null);

  Future<void> retry() {
    _fatalRuntime = false;
    return start();
  }

  Future<void> signOut() async {
    final service = _authService;
    if (service == null || service.currentSession == null) return;
    try {
      await service.signOut();
      notifyListeners();
    } catch (error, stackTrace) {
      _reporter.capture(AppErrorCategory.bootstrap, error, stackTrace);
      _setStatus(AppBootstrapStatus.failedStartup);
    }
  }

  Future<void> _run() async {
    _setStatus(AppBootstrapStatus.starting);
    try {
      if (!_configurationValid) {
        _platform.validateConfiguration();
        _configurationValid = true;
      }
    } catch (error, stackTrace) {
      _reporter.capture(AppErrorCategory.bootstrap, error, stackTrace);
      _setStatus(AppBootstrapStatus.failedConfiguration);
      return;
    }

    try {
      if (!_initialUriRead) {
        _initialUri = await _readInitialUriSafely();
        _initialUriRead = true;
      }
      if (!_supabaseInitialized) {
        await _platform.initializeSupabase();
        _supabaseInitialized = true;
        _authService = _platform.createAuthService();
      }
      if (!_recoveryStarted) {
        final service = _authService!;
        final coordinator = _recoveryCoordinator ??= _platform
            .createRecoveryCoordinator(service);
        await coordinator
            .start(initialUri: _initialUri, linkStream: _platform.linkStream)
            .timeout(const Duration(seconds: 15));
        _recoveryStarted = true;
      }
    } catch (error, stackTrace) {
      _reporter.capture(AppErrorCategory.bootstrap, error, stackTrace);
      _setStatus(AppBootstrapStatus.failedStartup);
      return;
    }

    // Device preferences are optional. Defaults remain usable when storage is
    // unavailable and must never hold the app on its native splash screen.
    await Future.wait([
      _loadOptional(themeController.load),
      _loadOptional(languageController.load),
    ]);
    if (_fatalRuntime) return;
    _setStatus(AppBootstrapStatus.ready);
  }

  Future<void> _loadOptional(Future<void> Function() load) async {
    try {
      await load().timeout(const Duration(seconds: 3));
    } catch (error, stackTrace) {
      _reporter.capture(AppErrorCategory.bootstrap, error, stackTrace);
    }
  }

  Future<Uri?> _readInitialUriSafely() async {
    try {
      return await _platform.readInitialUri().timeout(
        const Duration(seconds: 5),
      );
    } catch (error, stackTrace) {
      _reporter.capture(AppErrorCategory.bootstrap, error, stackTrace);
      return null;
    }
  }

  void markFatalRuntime() {
    _fatalRuntime = true;
    _setStatus(AppBootstrapStatus.fatalRuntime);
  }

  void _setStatus(AppBootstrapStatus next) {
    if (_status == next) return;
    _status = next;
    notifyListeners();
  }

  @override
  void dispose() {
    _recoveryCoordinator?.dispose();
    themeController.dispose();
    languageController.dispose();
    super.dispose();
  }
}
