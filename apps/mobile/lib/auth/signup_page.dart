import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../main.dart';
import '../theme/tokens.dart';
import '../widgets/callout.dart';
import '../widgets/password_strength_bar.dart';
import '../widgets/primary_button.dart';
import '../widgets/tharwati_text_field.dart';
import 'auth_scaffold.dart';
import 'password_policy.dart';

class SignUpPage extends StatefulWidget {
  const SignUpPage({super.key});

  @override
  State<SignUpPage> createState() => _SignUpPageState();
}

class _SignUpPageState extends State<SignUpPage> {
  final _formKey = GlobalKey<FormState>();
  final _fullName = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false;
  bool _agreed = false;
  String? _error;
  bool _checkEmail = false;

  @override
  void dispose() {
    _fullName.dispose();
    _email.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_agreed || !_formKey.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final res = await authService.signUp(
        _email.text.trim(),
        _password.text,
        fullName: _fullName.text,
      );
      if (res.session == null) {
        // Only reachable if email confirmation gets enabled in the dashboard.
        setState(() => _checkEmail = true);
      }
      // With a session, AuthGate routes on to onboarding automatically.
    } on AuthException catch (e) {
      if (kDebugMode) {
        debugPrint(
          'signUp AuthException: code=${e.code} status=${e.statusCode} '
          'message=${e.message}',
        );
      }
      setState(() => _error = _messageFor(e));
    } catch (e, s) {
      if (kDebugMode) debugPrint('signUp error: $e\n$s');
      setState(() => _error = 'Something went wrong. Please try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _messageFor(AuthException e) {
    switch (e.code) {
      case 'weak_password':
        return PasswordPolicy.helperText;
      case 'user_already_exists':
      case 'email_exists':
        return 'An account already uses this email. Sign in instead.';
      case 'over_email_send_rate_limit':
        return 'Email limit reached. Try again later, or ask an admin to turn '
            'off email confirmation.';
      case 'over_request_rate_limit':
        return 'Too many attempts. Wait a minute and try again.';
      case 'signup_disabled':
        return 'New sign-ups are turned off right now.';
      case 'captcha_failed':
        return 'Captcha check failed. Try again.';
      case 'email_provider_disabled':
        return 'Email sign-up is disabled for this project.';
      case 'email_address_invalid':
      case 'validation_failed':
        return 'That email address looks invalid.';
    }
    // Surface the backend text in debug so the real cause is visible.
    return kDebugMode
        ? 'Could not create the account: ${e.message}'
        : 'Could not create the account. Please try again.';
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;

    if (_checkEmail) {
      return AuthScaffold(
        showBack: true,
        title: 'Check your email',
        children: [
          Callout(
            tone: CalloutTone.success,
            title: 'Confirm your account',
            message:
                'We emailed a confirmation link to ${_email.text.trim()}. '
                'Open it on this device — it brings you straight back into the '
                'app.',
          ),
          const SizedBox(height: 16),
          PrimaryButton(
            label: 'Back to sign in',
            onPressed: () => Navigator.of(context).pop(),
          ),
        ],
      );
    }

    return AuthScaffold(
      showBack: true,
      title: 'Create your account',
      subtitle:
          'Tharwati stores records, never credentials to your bank. Nothing '
          'connects to real money.',
      error: _error,
      children: [
        Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TharwatiTextField(
                label: 'Full name',
                controller: _fullName,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.name],
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Enter your name' : null,
              ),
              const SizedBox(height: 14),
              TharwatiTextField(
                label: 'Email',
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.email],
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Enter your email' : null,
              ),
              const SizedBox(height: 14),
              TharwatiTextField(
                label: 'Password',
                controller: _password,
                obscurable: true,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.newPassword],
                validator: PasswordPolicy.problem,
                onChanged: (_) => setState(() {}),
              ),
              PasswordStrengthBar(password: _password.text),
              const SizedBox(height: 14),
              TharwatiTextField(
                label: 'Confirm password',
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
        InkWell(
          onTap: () => setState(() => _agreed = !_agreed),
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Checkbox(
                  value: _agreed,
                  onChanged: (v) => setState(() => _agreed = v ?? false),
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  visualDensity: VisualDensity.compact,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text.rich(
                      TextSpan(
                        text: 'I agree to the ',
                        style: TextStyle(
                          color: c.ink.withValues(alpha: 0.8),
                          fontSize: 13,
                          height: 1.5,
                        ),
                        children: [
                          TextSpan(
                            text: 'Terms',
                            style: TextStyle(
                              color: c.accent,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const TextSpan(text: ' and '),
                          TextSpan(
                            text: 'Privacy Policy',
                            style: TextStyle(
                              color: c.accent,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const TextSpan(text: '.'),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        PrimaryButton(
          label: 'Create account',
          busy: _busy,
          onPressed: _agreed ? _submit : null,
        ),
        const SizedBox(height: 4),
        TextButton(
          onPressed: _busy ? null : () => Navigator.of(context).pop(),
          child: const Text('I already have an account'),
        ),
      ],
    );
  }
}
