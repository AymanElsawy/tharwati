import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../main.dart';
import '../theme/tokens.dart';
import '../widgets/brand_mark.dart';
import '../widgets/primary_button.dart';
import '../widgets/tharwati_text_field.dart';
import 'auth_scaffold.dart';
import 'forgot_password_page.dart';
import 'signup_page.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await authService.signIn(_email.text.trim(), _password.text);
      // AuthGate picks up the new session from the auth stream.
    } on AuthException {
      setState(() => _error = 'Incorrect email or password.');
    } catch (_) {
      setState(() => _error = 'Something went wrong. Please try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return AuthScaffold(
      header: const BrandMark(),
      error: _error,
      footer: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text.rich(
            TextSpan(
              text: 'New to Tharwati? ',
              style: TextStyle(color: c.inkMuted, fontSize: 14),
              children: [
                WidgetSpan(
                  alignment: PlaceholderAlignment.middle,
                  child: GestureDetector(
                    onTap: _busy
                        ? null
                        : () => Navigator.of(context).push(
                            MaterialPageRoute<void>(
                              builder: (_) => const SignUpPage(),
                            ),
                          ),
                    child: Text(
                      'Create an account',
                      style: TextStyle(
                        color: c.accent,
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: const [
              _LocalePill(label: 'العربية'),
              SizedBox(width: 8),
              _LocalePill(label: 'EGP'),
            ],
          ),
        ],
      ),
      children: [
        Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TharwatiTextField(
                label: 'Email',
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.email],
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Enter your email' : null,
              ),
              const SizedBox(height: 16),
              TharwatiTextField(
                label: 'Password',
                controller: _password,
                obscurable: true,
                textInputAction: TextInputAction.done,
                autofillHints: const [AutofillHints.password],
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Enter your password' : null,
                onFieldSubmitted: (_) => _submit(),
              ),
              Align(
                alignment: AlignmentDirectional.centerEnd,
                child: TextButton(
                  onPressed: _busy
                      ? null
                      : () => Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) => const ForgotPasswordPage(),
                          ),
                        ),
                  child: const Text('Forgot password?'),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        PrimaryButton(label: 'Sign in', busy: _busy, onPressed: _submit),
      ],
    );
  }
}

/// Static language / currency chips from the Sign in artboard. Wiring for the
/// bilingual + multi-currency switch lands with those flows; these are the
/// visual entry points only.
class _LocalePill extends StatelessWidget {
  const _LocalePill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      constraints: const BoxConstraints(minHeight: AppSizes.touchTarget),
      alignment: Alignment.center,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: c.surface,
        border: Border.all(color: c.line),
        borderRadius: BorderRadius.circular(AppRadius.field),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: c.ink.withValues(alpha: 0.8),
          fontSize: 13,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
