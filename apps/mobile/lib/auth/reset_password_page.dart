import 'dart:async';

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../main.dart';
import '../i18n/app_language.dart';
import '../i18n/recovery_copy.dart';
import '../theme/tokens.dart';
import '../widgets/callout.dart';
import '../widgets/primary_button.dart';
import '../widgets/tharwati_text_field.dart';
import 'auth_scaffold.dart';
import 'password_policy.dart';

/// Shown over the whole app after a PASSWORD_RECOVERY event (docs/auth.md).
class ResetPasswordPage extends StatefulWidget {
  const ResetPasswordPage({
    super.key,
    required this.onRecoveryFinished,
    required this.onRecoveryCancelled,
    this.updatePassword,
    this.signOut,
    this.onInvalid,
  });

  final FutureOr<void> Function() onRecoveryFinished;
  final FutureOr<void> Function() onRecoveryCancelled;
  final Future<void> Function(String password)? updatePassword;
  final Future<void> Function()? signOut;
  final VoidCallback? onInvalid;

  @override
  State<ResetPasswordPage> createState() => _ResetPasswordPageState();
}

class _ResetPasswordPageState extends State<ResetPasswordPage> {
  final _formKey = GlobalKey<FormState>();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false;
  String? _error;
  bool _expired = false;
  bool _done = false;

  Future<void> _updatePassword(String password) =>
      widget.updatePassword?.call(password) ??
      authService.updatePassword(password);

  Future<void> _signOut() async {
    await widget.signOut?.call();
  }

  RecoveryCopy get _copy => RecoveryCopy.of(
    context
            .dependOnInheritedWidgetOfExactType<AppLanguageScope>()
            ?.notifier
            ?.language ??
        AppLanguage.en,
  );

  @override
  void dispose() {
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
      _expired = false;
    });
    try {
      await _updatePassword(_password.text);
      _password.clear();
      _confirm.clear();
      try {
        await widget.onRecoveryFinished();
        // Supabase clears the local session before attempting server revocation.
        // A revocation/network failure must not misreport the password update.
        await _signOut();
      } catch (_) {}
      if (mounted) {
        setState(() => _done = true);
      }
    } on AuthException catch (e) {
      if (!mounted) return;
      if (e is AuthSessionMissingException ||
          const {
            'session_not_found',
            'bad_jwt',
            'jwt_expired',
            'refresh_token_not_found',
          }.contains(e.code)) {
        widget.onInvalid?.call();
        setState(() => _expired = true);
        return;
      }
      setState(() {
        if (e is AuthSessionMissingException) {
          _expired = true;
        } else if (e.code == 'weak_password') {
          _error = PasswordPolicy.helperText;
        } else {
          _error = _copy.updateError;
        }
      });
    } catch (_) {
      if (mounted) setState(() => _error = _copy.updateError);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancel() async {
    setState(() => _busy = true);
    try {
      await _signOut();
    } catch (_) {
      // Supabase has already cleared its local session before remote sign-out.
    } finally {
      if (mounted) {
        await widget.onRecoveryCancelled();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_done) {
      return AuthScaffold(
        title: 'Password updated',
        children: [
          const Callout(
            tone: CalloutTone.success,
            title: 'You’re all set',
            message: 'Sign in with your new password.',
          ),
          const SizedBox(height: 16),
          PrimaryButton(
            label: 'Go to sign in',
            onPressed: widget.onRecoveryFinished,
          ),
        ],
      );
    }

    return AuthScaffold(
      title: _copy.title,

      error: _error,
      children: [
        Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TharwatiTextField(
                label: 'New password',
                controller: _password,
                obscurable: true,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.newPassword],
                validator: PasswordPolicy.problem,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 14),
              TharwatiTextField(
                label: 'Confirm new password',
                controller: _confirm,
                obscurable: true,
                textInputAction: TextInputAction.done,
                validator: (v) =>
                    v != _password.text ? 'Passwords don’t match.' : null,
                onFieldSubmitted: (_) => _submit(),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _PasswordRulesCard(password: _password.text),
        const SizedBox(height: 16),
        if (_expired) ...[
          Callout(tone: CalloutTone.warning, message: _copy.invalidLink),
          const SizedBox(height: 16),
        ],
        if (_expired)
          PrimaryButton(
            label: 'Back to sign in',
            busy: _busy,
            onPressed: _cancel,
          )
        else ...[
          PrimaryButton(
            label: 'Save new password',
            busy: _busy,
            onPressed: _submit,
          ),
          const SizedBox(height: 8),
          SecondaryButton(label: _copy.cancel, busy: _busy, onPressed: _cancel),
        ],
      ],
    );
  }
}

/// "Password rules" card from artboard 04, with each rule ticking live as the
/// typed password satisfies it.
class _PasswordRulesCard extends StatelessWidget {
  const _PasswordRulesCard({required this.password});

  final String password;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final rules = <(String, bool)>[
      (
        '${PasswordPolicy.minLength} characters or more',
        password.length >= PasswordPolicy.minLength,
      ),
      ('An uppercase letter', RegExp(r'[A-Z]').hasMatch(password)),
      ('A lowercase letter', RegExp(r'[a-z]').hasMatch(password)),
      ('Contains a number', RegExp(r'[0-9]').hasMatch(password)),
    ];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: c.surface,
        border: Border.all(color: c.line),
        borderRadius: BorderRadius.circular(AppRadius.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Password rules',
            style: TextStyle(
              color: c.ink,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 10),
          for (final (text, met) in rules)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  Icon(
                    met ? Icons.check_circle : Icons.circle_outlined,
                    size: 16,
                    color: met ? c.accent : c.inkMuted.withValues(alpha: 0.6),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    text,
                    style: TextStyle(
                      color: met ? c.ink.withValues(alpha: 0.8) : c.inkMuted,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
