import 'package:flutter/material.dart';

import '../main.dart';
import '../widgets/callout.dart';
import '../widgets/primary_button.dart';
import '../widgets/tharwati_text_field.dart';
import 'auth_scaffold.dart';

class ForgotPasswordPage extends StatefulWidget {
  const ForgotPasswordPage({super.key});

  @override
  State<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends State<ForgotPasswordPage> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  bool _busy = false;
  String? _error;
  bool _sent = false;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await authService.requestPasswordReset(_email.text.trim());
      setState(() => _sent = true); // Neutral message — no account enumeration.
    } catch (_) {
      setState(() => _error = 'Something went wrong. Please try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      showBack: true,
      title: 'Reset your password',
      subtitle: 'We’ll email a one-time link. It expires in 30 minutes.',
      error: _sent ? null : _error,
      children: [
        Form(
          key: _formKey,
          child: TharwatiTextField(
            label: 'Email',
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.done,
            autofillHints: const [AutofillHints.email],
            validator: (v) =>
                (v == null || v.trim().isEmpty) ? 'Enter your email' : null,
            onFieldSubmitted: (_) => _submit(),
          ),
        ),
        const SizedBox(height: 16),
        if (_sent) ...[
          Callout(
            tone: CalloutTone.success,
            title: 'Check your inbox',
            message:
                'If an account exists for ${_email.text.trim()}, a reset link '
                'is on its way.',
          ),
          const SizedBox(height: 16),
        ] else ...[
          PrimaryButton(
            label: 'Send reset link',
            busy: _busy,
            onPressed: _submit,
          ),
          const SizedBox(height: 4),
        ],
        TextButton(
          onPressed: _busy ? null : () => Navigator.of(context).pop(),
          child: const Text('Back to sign in'),
        ),
      ],
    );
  }
}
