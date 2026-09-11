import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../main.dart';
import '../i18n/app_language.dart';
import '../i18n/login_copy.dart';
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
    if (!_formKey.currentState!.validate()) {
      return;
    }
    final copy = LoginCopy.of(AppLanguageScope.of(context).language);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await authService.signIn(_email.text.trim(), _password.text);
      // AuthGate picks up the new session from the auth stream.
    } on AuthException {
      setState(() => _error = copy.incorrectCredentials);
    } catch (_) {
      setState(() => _error = copy.genericError);
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final language = AppLanguageScope.of(context).language;
    final copy = LoginCopy.of(language);
    return AuthScaffold(
      header: const BrandMark(),
      error: _error,
      footer: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text.rich(
            TextSpan(
              text: copy.newToTharwati,
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
                      copy.createAccount,
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
          _LanguagePicker(language: language, copy: copy),
        ],
      ),
      children: [
        Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TharwatiTextField(
                label: copy.email,
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                textDirection: TextDirection.ltr,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.email],
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? copy.emailRequired : null,
              ),
              const SizedBox(height: 16),
              TharwatiTextField(
                label: copy.password,
                controller: _password,
                obscurable: true,
                showPasswordTooltip: copy.showPassword,
                hidePasswordTooltip: copy.hidePassword,
                textInputAction: TextInputAction.done,
                autofillHints: const [AutofillHints.password],
                validator: (v) =>
                    (v == null || v.isEmpty) ? copy.passwordRequired : null,
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
                  child: Text(copy.forgotPassword),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        PrimaryButton(label: copy.signIn, busy: _busy, onPressed: _submit),
      ],
    );
  }
}

class _LanguagePicker extends StatelessWidget {
  const _LanguagePicker({required this.language, required this.copy});

  final AppLanguage language;
  final LoginCopy copy;

  @override
  Widget build(BuildContext context) {
    final controller = AppLanguageScope.of(context);
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _LanguagePill(
          label: copy.english,
          selected: language == AppLanguage.en,
          onPressed: () => controller.setLanguage(AppLanguage.en),
        ),
        const SizedBox(width: 8),
        _LanguagePill(
          label: copy.arabic,
          selected: language == AppLanguage.ar,
          onPressed: () => controller.setLanguage(AppLanguage.ar),
        ),
      ],
    );
  }
}

class _LanguagePill extends StatelessWidget {
  const _LanguagePill({
    required this.label,
    required this.selected,
    required this.onPressed,
  });

  final String label;
  final bool selected;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Semantics(
      selected: selected,
      button: true,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(0, AppSizes.touchTarget),
          padding: const EdgeInsets.symmetric(horizontal: 14),
          foregroundColor: selected ? c.accent : c.inkMuted,
          backgroundColor: selected ? c.accentSoft : c.surface,
          side: BorderSide(color: selected ? c.accent : c.line),
          textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
        ),
        child: Text(label),
      ),
    );
  }
}
