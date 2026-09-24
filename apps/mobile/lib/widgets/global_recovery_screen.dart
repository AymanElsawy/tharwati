import 'package:flutter/material.dart';

import '../bootstrap/app_bootstrap_controller.dart';
import '../i18n/app_language.dart';

class GlobalRecoveryScreen extends StatelessWidget {
  const GlobalRecoveryScreen({
    super.key,
    required this.status,
    required this.language,
    this.onRetry,
    this.onSignOut,
  });

  final AppBootstrapStatus status;
  final AppLanguage language;
  final VoidCallback? onRetry;
  final VoidCallback? onSignOut;

  @override
  Widget build(BuildContext context) {
    final ar = language == AppLanguage.ar;
    final title = switch (status) {
      AppBootstrapStatus.starting =>
        ar ? 'جارٍ بدء ثروتي' : 'Starting Tharwati',
      AppBootstrapStatus.failedConfiguration =>
        ar ? 'تعذر بدء التطبيق' : 'Startup unavailable',
      AppBootstrapStatus.failedStartup =>
        ar ? 'الاتصال غير متاح' : 'Connection unavailable',
      AppBootstrapStatus.fatalRuntime =>
        ar ? 'حدث خطأ غير متوقع في التطبيق' : 'Unexpected application error',
      AppBootstrapStatus.ready =>
        ar ? 'الحساب غير متاح' : 'Account unavailable',
    };
    final message = ar
        ? 'بياناتك وجلستك محفوظتان. يرجى المحاولة مرة أخرى.'
        : 'Your data and session are safe. Please try again.';

    return Directionality(
      textDirection: language.direction,
      child: Scaffold(
        backgroundColor: const Color(0xFF071C17),
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Image.asset(
                      'assets/branding/tharwati-app-icon.png',
                      width: 112,
                      height: 112,
                      semanticLabel: 'Tharwati',
                    ),
                    const SizedBox(height: 28),
                    Text(
                      title,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 24,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (status == AppBootstrapStatus.starting)
                      const Center(
                        child: CircularProgressIndicator(
                          color: Color(0xFFC9A96B),
                        ),
                      )
                    else ...[
                      Text(
                        message,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Colors.white70,
                          height: 1.5,
                        ),
                      ),
                      const SizedBox(height: 24),
                      FilledButton(
                        onPressed: onRetry,
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFFC9A96B),
                          foregroundColor: const Color(0xFF071C17),
                          minimumSize: const Size.fromHeight(48),
                        ),
                        child: Text(ar ? 'إعادة المحاولة' : 'Retry'),
                      ),
                      if (onSignOut != null) ...[
                        const SizedBox(height: 8),
                        TextButton(
                          onPressed: onSignOut,
                          child: Text(
                            ar ? 'تسجيل الخروج' : 'Sign out',
                            style: const TextStyle(color: Colors.white),
                          ),
                        ),
                      ],
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
