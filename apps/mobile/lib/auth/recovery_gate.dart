import 'package:flutter/material.dart';

import '../i18n/app_language.dart';
import '../i18n/recovery_copy.dart';
import '../widgets/primary_button.dart';
import 'auth_recovery_coordinator.dart';
import 'auth_scaffold.dart';
import 'reset_password_page.dart';

/// MaterialApp.builder places this ABOVE the Navigator. Replacing its child
/// disposes conflicting pushed routes instead of hiding recovery behind them.
class RecoveryGate extends StatelessWidget {
  const RecoveryGate({
    super.key,
    required this.coordinator,
    required this.child,
    required this.onRequestNewLink,
    this.activeBuilder,
  });

  final AuthRecoveryCoordinator coordinator;
  final Widget child;
  final Future<void> Function() onRequestNewLink;
  final WidgetBuilder? activeBuilder;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: coordinator,
    builder: (context, _) {
      if (!coordinator.isIsolating) return child;
      // A separate Navigator supplies the Overlay required by editable fields.
      // Its distinct key also disposes the ordinary app's pushed route stack.
      return Navigator(
        key: const ValueKey('password-recovery'),
        onGenerateRoute: (_) => MaterialPageRoute<void>(
          builder: (context) => ListenableBuilder(
            listenable: coordinator,
            builder: (context, _) =>
                PopScope(canPop: false, child: _surface(context)),
          ),
        ),
      );
    },
  );

  Widget _surface(BuildContext context) {
    if (coordinator.isActive) {
      return activeBuilder?.call(context) ??
          ResetPasswordPage(
            onRecoveryFinished: coordinator.complete,
            onRecoveryCancelled: coordinator.cancel,
            onInvalid: coordinator.invalidate,
          );
    }
    final language =
        context
            .dependOnInheritedWidgetOfExactType<AppLanguageScope>()
            ?.notifier
            ?.language ??
        AppLanguage.en;
    final copy = RecoveryCopy.of(language);
    final checking = coordinator.status == AuthRecoveryStatus.checking;
    final transport = coordinator.status == AuthRecoveryStatus.transportFailure;
    return AuthScaffold(
      title: copy.title,
      error: checking
          ? null
          : transport
          ? copy.transportError
          : copy.invalidLink,
      children: [
        if (checking)
          Text(copy.checking)
        else ...[
          if (coordinator.canRetry)
            PrimaryButton(label: copy.retry, onPressed: coordinator.retry),
          PrimaryButton(
            label: copy.requestNewLink,
            onPressed: onRequestNewLink,
          ),
        ],
        if (!checking)
          SecondaryButton(label: copy.cancel, onPressed: coordinator.cancel),
      ],
    );
  }
}
