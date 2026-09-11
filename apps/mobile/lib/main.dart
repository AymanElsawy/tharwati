import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'auth/auth_gate.dart';
import 'auth/auth_service.dart';
import 'auth/reset_password_page.dart';
import 'env.dart';
import 'i18n/app_language.dart';
import 'splash/splash_screen.dart';
import 'theme/app_theme.dart';

late final AuthService authService;

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Supabase.initialize(
    url: Env.supabaseUrl,
    anonKey: Env.supabaseAnonKey,
    // supabase_flutter persists the session and auto-refreshes tokens by default.
  );
  authService = AuthService(Supabase.instance.client);
  runApp(const TharwatiApp());
}

class TharwatiApp extends StatefulWidget {
  const TharwatiApp({super.key, this.languageController});

  final AppLanguageController? languageController;

  @override
  State<TharwatiApp> createState() => _TharwatiAppState();
}

class _TharwatiAppState extends State<TharwatiApp> {
  final _navigatorKey = GlobalKey<NavigatorState>();
  var _showAuthGate = false;
  late final AppLanguageController _languageController;
  late final bool _ownsLanguageController;

  @override
  void initState() {
    super.initState();
    _ownsLanguageController = widget.languageController == null;
    _languageController = widget.languageController ?? AppLanguageController();
    _languageController.load();
    // A recovery deep link fires PASSWORD_RECOVERY once Supabase parses the URL.
    // Push the reset screen over everything else (docs/auth.md recovery gate).
    authService.onAuthStateChange.listen((state) {
      if (state.event == AuthChangeEvent.passwordRecovery) {
        _navigatorKey.currentState?.push(
          MaterialPageRoute<void>(builder: (_) => const ResetPasswordPage()),
        );
      }
    });
  }

  @override
  void dispose() {
    if (_ownsLanguageController) {
      _languageController.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _languageController,
      builder: (context, _) => MaterialApp(
        title: 'Tharwati',
        debugShowCheckedModeBanner: false,
        navigatorKey: _navigatorKey,
        locale: _languageController.language.locale,
        supportedLocales: AppLanguage.values.map((language) => language.locale),
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        theme: AppTheme.light(),
        darkTheme: AppTheme.dark(),
        themeMode: ThemeMode.system,
        builder: (context, child) => AppLanguageScope(
          controller: _languageController,
          child: Directionality(
            textDirection: _languageController.language.direction,
            child: child ?? const SizedBox.shrink(),
          ),
        ),
        home: _showAuthGate
            ? const AuthGate()
            : SplashScreen(
                onComplete: () => setState(() => _showAuthGate = true),
              ),
      ),
    );
  }
}
