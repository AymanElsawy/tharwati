import 'package:flutter/material.dart';

import '../errors/global_failure_controller.dart';
import '../main.dart' show TharwatiApp, authService;
import '../theme/app_theme.dart';
import '../widgets/global_recovery_screen.dart';
import 'app_bootstrap_controller.dart';

class BootstrapApp extends StatefulWidget {
  const BootstrapApp({
    super.key,
    required this.controller,
    required this.failureController,
  });

  final AppBootstrapController controller;
  final GlobalFailureController failureController;

  @override
  State<BootstrapApp> createState() => _BootstrapAppState();
}

class _BootstrapAppState extends State<BootstrapApp> {
  bool _publishedAuthService = false;

  @override
  void initState() {
    super.initState();
    widget.failureController.addListener(_onFatalFailure);
    _onFatalFailure();
    widget.controller.start();
  }

  void _onFatalFailure() {
    if (widget.failureController.hasFatalFailure) {
      widget.controller.markFatalRuntime();
    }
  }

  @override
  void dispose() {
    widget.failureController.removeListener(_onFatalFailure);
    widget.controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.controller,
    builder: (context, _) {
      if (widget.controller.status == AppBootstrapStatus.ready) {
        if (!_publishedAuthService) {
          authService = widget.controller.authService!;
          _publishedAuthService = true;
        }
        return TharwatiApp(
          recoveryCoordinator: widget.controller.recoveryCoordinator!,
          themeController: widget.controller.themeController,
          languageController: widget.controller.languageController,
          ownsBootstrapResources: false,
        );
      }

      return MaterialApp(
        title: 'Tharwati',
        debugShowCheckedModeBanner: false,
        locale: widget.controller.languageController.language.locale,
        theme: AppTheme.light(),
        darkTheme: AppTheme.dark(),
        themeMode: widget.controller.themeController.themeMode,
        home: GlobalRecoveryScreen(
          status: widget.controller.status,
          language: widget.controller.languageController.language,
          onRetry: widget.controller.status == AppBootstrapStatus.starting
              ? null
              : () {
                  if (widget.controller.status ==
                      AppBootstrapStatus.fatalRuntime) {
                    widget.failureController.retry();
                  }
                  widget.controller.retry();
                },
          onSignOut: widget.controller.canSignOut
              ? () => widget.controller.signOut()
              : null,
        ),
      );
    },
  );
}
