import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'auth/auth_gate.dart';
import 'auth/auth_recovery_coordinator.dart';
import 'auth/auth_service.dart';
import 'auth/reset_password_page.dart';
import 'bootstrap/app_bootstrap_controller.dart';
import 'bootstrap/bootstrap_app.dart';
import 'errors/app_error_reporter.dart';
import 'errors/global_failure_controller.dart';
import 'i18n/app_language.dart';
import 'splash/splash_screen.dart';
import 'theme/app_theme.dart';
import 'theme/app_theme_controller.dart';

late AuthService authService;

void main() {
  final reporter = const NoopAppErrorReporter();
  final failureController = GlobalFailureController();

  runZonedGuarded(
    () {
      WidgetsFlutterBinding.ensureInitialized();
      FlutterError.onError = (details) {
        reporter.capture(
          AppErrorCategory.flutterFramework,
          details.exception,
          details.stack ?? StackTrace.current,
        );
        WidgetsBinding.instance.addPostFrameCallback(
          (_) => failureController.reportFatal(),
        );
      };
      PlatformDispatcher.instance.onError = (error, stackTrace) {
        reporter.capture(AppErrorCategory.platform, error, stackTrace);
        failureController.reportFatal();
        return true;
      };
      ErrorWidget.builder = (_) => const ColoredBox(
        color: Color(0xFF071C17),
        child: Center(
          child: Icon(Icons.error_outline, color: Color(0xFFC9A96B)),
        ),
      );

      runApp(
        BootstrapApp(
          controller: AppBootstrapController(reporter: reporter),
          failureController: failureController,
        ),
      );
    },
    (error, stackTrace) {
      reporter.capture(AppErrorCategory.zone, error, stackTrace);
      failureController.reportFatal();
    },
  );
}

class TharwatiApp extends StatefulWidget {
  const TharwatiApp({
    super.key,
    required this.recoveryCoordinator,
    this.languageController,
    this.themeController,
    this.ownsBootstrapResources = true,
  });

  final AuthRecoveryCoordinator recoveryCoordinator;
  final AppLanguageController? languageController;
  final AppThemeController? themeController;
  final bool ownsBootstrapResources;

  @override
  State<TharwatiApp> createState() => _TharwatiAppState();
}

class _TharwatiAppState extends State<TharwatiApp> {
  var _showAuthGate = false;
  late final AppLanguageController _languageController;
  late final bool _ownsLanguageController;
  late final AppThemeController _themeController;
  late final bool _ownsThemeController;

  @override
  void initState() {
    super.initState();
    _ownsLanguageController = widget.languageController == null;
    _languageController = widget.languageController ?? AppLanguageController();
    if (_ownsLanguageController) {
      unawaited(_languageController.load());
    }
    _ownsThemeController = widget.themeController == null;
    _themeController = widget.themeController ?? AppThemeController();
    if (_ownsThemeController) {
      unawaited(_themeController.load());
    }
  }

  @override
  void dispose() {
    if (_ownsLanguageController) {
      _languageController.dispose();
    }
    if (_ownsThemeController) {
      _themeController.dispose();
    }
    if (widget.ownsBootstrapResources) {
      widget.recoveryCoordinator.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.recoveryCoordinator,
      builder: (context, _) => ListenableBuilder(
        listenable: _themeController,
        builder: (context, _) => ListenableBuilder(
          listenable: _languageController,
          builder: (context, _) => MaterialApp(
            title: 'Tharwati',
            debugShowCheckedModeBanner: false,
            locale: _languageController.language.locale,
            supportedLocales: AppLanguage.values.map(
              (language) => language.locale,
            ),
            localizationsDelegates: const [
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            theme: AppTheme.light(),
            darkTheme: AppTheme.dark(),
            themeMode: _themeController.themeMode,
            builder: (context, child) => AppThemeScope(
              controller: _themeController,
              child: AppLanguageScope(
                controller: _languageController,
                child: Directionality(
                  textDirection: _languageController.language.direction,
                  child: child ?? const SizedBox.shrink(),
                ),
              ),
            ),
            home: widget.recoveryCoordinator.isActive
                ? ResetPasswordPage(
                    onRecoveryFinished: widget.recoveryCoordinator.complete,
                    onRecoveryCancelled: widget.recoveryCoordinator.cancel,
                  )
                : _showAuthGate
                ? const AuthGate()
                : SplashScreen(
                    onComplete: () => setState(() => _showAuthGate = true),
                  ),
          ),
        ),
      ),
    );
  }
}
