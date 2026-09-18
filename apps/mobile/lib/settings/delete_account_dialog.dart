import 'package:flutter/material.dart';

import '../i18n/settings_copy.dart';
import '../theme/tokens.dart';
import 'account_deletion_controller.dart';

class DeleteAccountDialog extends StatefulWidget {
  const DeleteAccountDialog({
    super.key,
    required this.controller,
    required this.copy,
  });

  final AccountDeletionController controller;
  final SettingsCopy copy;

  @override
  State<DeleteAccountDialog> createState() => _DeleteAccountDialogState();
}

class _DeleteAccountDialogState extends State<DeleteAccountDialog> {
  final _password = TextEditingController();
  final _confirmation = TextEditingController();

  @override
  void dispose() {
    _password.dispose();
    _confirmation.dispose();
    super.dispose();
  }

  void _cancel() {
    widget.controller.cancel();
    _password.clear();
    _confirmation.clear();
    Navigator.of(context).pop();
  }

  Future<void> _reauthenticate() async {
    widget.controller.setPassword(_password.text);
    await widget.controller.submitPassword();
    if (!mounted) return;
    if (widget.controller.step == AccountDeletionStep.password) {
      _password.clear();
    }
  }

  Future<void> _delete() async {
    await widget.controller.permanentlyDelete();
    if (!mounted) return;
    if (widget.controller.step == AccountDeletionStep.completed) {
      _password.clear();
      _confirmation.clear();
      Navigator.of(context).pop();
    } else {
      _password.clear();
      _confirmation.clear();
    }
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.controller,
    builder: (context, _) {
      final controller = widget.controller;
      final copy = widget.copy;
      return PopScope(
        canPop: !controller.inFlight,
        child: AlertDialog(
          insetPadding: const EdgeInsets.symmetric(
            horizontal: 20,
            vertical: 24,
          ),
          title: Text(copy.deleteDialogTitle),
          content: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    controller.step == AccountDeletionStep.password
                        ? copy.deletePasswordDescription
                        : copy.deleteConfirmationDescription,
                  ),
                  const SizedBox(height: 16),
                  if (controller.step == AccountDeletionStep.password) ...[
                    TextField(
                      key: const Key('delete-password'),
                      controller: _password,
                      obscureText: true,
                      enabled: !controller.inFlight,
                      autofillHints: const [AutofillHints.password],
                      decoration: InputDecoration(
                        labelText: copy.currentPassword,
                        errorText: _errorText(copy, controller.failure),
                      ),
                      onSubmitted: (_) => _reauthenticate(),
                    ),
                  ] else ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: context.colors.negative.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(AppRadius.field),
                        border: Border.all(
                          color: context.colors.negative.withValues(
                            alpha: 0.35,
                          ),
                        ),
                      ),
                      child: Text(copy.deletePermanentWarning),
                    ),
                    const SizedBox(height: 16),
                    Text(copy.typeEmailInstruction),
                    const SizedBox(height: 4),
                    Text(
                      controller.email,
                      textDirection: TextDirection.ltr,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      key: const Key('delete-email-confirmation'),
                      controller: _confirmation,
                      enabled: !controller.inFlight,
                      textDirection: TextDirection.ltr,
                      autocorrect: false,
                      enableSuggestions: false,
                      decoration: InputDecoration(labelText: copy.confirmEmail),
                      onChanged: controller.setConfirmation,
                    ),
                  ],
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: controller.inFlight ? null : _cancel,
              child: Text(copy.cancel),
            ),
            if (controller.step == AccountDeletionStep.password)
              FilledButton(
                onPressed: controller.inFlight ? null : _reauthenticate,
                child: Text(
                  controller.inFlight
                      ? copy.checkingPassword
                      : copy.continueAction,
                ),
              )
            else
              FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: context.colors.negative,
                ),
                onPressed: controller.canConfirmEmail ? _delete : null,
                child: Text(
                  controller.inFlight
                      ? copy.deletingAccount
                      : copy.deleteAccount,
                ),
              ),
          ],
        ),
      );
    },
  );

  String? _errorText(SettingsCopy copy, AccountDeletionFailure? failure) {
    return switch (failure) {
      AccountDeletionFailure.reauthenticationFailed => copy.wrongPassword,
      AccountDeletionFailure.unauthenticated => copy.sessionExpired,
      AccountDeletionFailure.deletionFailed => copy.deleteFailed,
      AccountDeletionFailure.uncertain => copy.deleteUncertain,
      null => null,
    };
  }
}
