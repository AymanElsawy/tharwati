import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'auth/auth_gate.dart';
import 'auth/auth_recovery_coordinator.dart';
import 'auth/auth_service.dart';
import 'auth/reset_password_page.dart';
import 'env.dart';
import 'i18n/app_language.dart';
import 'splash/splash_screen.dart';
import 'theme/app_theme.dart';
import 'theme/app_theme_controller.dart';

late final AuthService authService;

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final appLinks = AppLinks();
  final initialUri = await _readInitialUri(appLinks);
  await Supabase.initialize(
    url: Env.supabaseUrl,
    anonKey: Env.supabaseAnonKey,
    authOptions: const FlutterAuthClientOptions(detectSessionInUri: false),
    // supabase_flutter persists the session and auto-refreshes tokens by default.
  );
  authService = AuthService(Supabase.instance.client);
  final recoveryCoordinator = AuthRecoveryCoordinator(authService);
  await recoveryCoordinator.start(
    initialUri: initialUri,
    linkStream: appLinks.uriLinkStream,
  );
  final themeController = AppThemeController();
  await themeController.load();
  runApp(
    TharwatiApp(
      recoveryCoordinator: recoveryCoordinator,
      themeController: themeController,
    ),
  );
}

Future<Uri?> _readInitialUri(AppLinks appLinks) async {
  try {
    return await appLinks.getInitialLink();
  } catch (_) {
    // A platform-link lookup failure must not block ordinary app startup.
    return null;
  }
}

class TharwatiApp extends StatefulWidget {
  const TharwatiApp({
    super.key,
    required this.recoveryCoordinator,
    this.languageController,
    this.themeController,
  });

  final AuthRecoveryCoordinator recoveryCoordinator;
  final AppLanguageController? languageController;
  final AppThemeController? themeController;

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
    _languageController.load();
    _ownsThemeController = widget.themeController == null;
    _themeController = widget.themeController ?? AppThemeController();
    _themeController.load();
  }

  @override
  void dispose() {
    if (_ownsLanguageController) {
      _languageController.dispose();
    }
    if (_ownsThemeController) {
      _themeController.dispose();
    }
    widget.recoveryCoordinator.dispose();
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
