import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../i18n/app_language.dart';
import '../theme/tokens.dart';

enum LegalDocument { privacy, terms }

const legalWebOrigin = 'https://tharwati-dgp.pages.dev';

Uri legalUrl(LegalDocument document, AppLanguage language) =>
    Uri.parse('$legalWebOrigin/${document.name}?lang=${language.code}');

String legalLabel(LegalDocument document, AppLanguage language) =>
    switch (document) {
      LegalDocument.privacy =>
        language == AppLanguage.ar ? 'سياسة الخصوصية' : 'Privacy Policy',
      LegalDocument.terms =>
        language == AppLanguage.ar ? 'شروط الاستخدام' : 'Terms',
    };

class LegalLink extends StatelessWidget {
  const LegalLink({super.key, required this.document});

  final LegalDocument document;

  @override
  Widget build(BuildContext context) {
    final language = AppLanguageScope.of(context).language;
    return TextButton(
      key: Key('legal-${document.name}'),
      style: TextButton.styleFrom(
        foregroundColor: context.colors.accent,
        minimumSize: const Size(44, 44),
        textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
      ),
      onPressed: () async {
        try {
          if (await launchUrl(
            legalUrl(document, language),
            mode: LaunchMode.externalApplication,
          )) {
            return;
          }
        } catch (_) {
          // Launch failures use the same localized feedback as a false result.
        }
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              language == AppLanguage.ar
                  ? 'تعذر فتح الصفحة. حاول مجددًا.'
                  : 'Could not open the page. Please try again.',
            ),
          ),
        );
      },
      child: Text(legalLabel(document, language)),
    );
  }
}

class LegalLinks extends StatelessWidget {
  const LegalLinks({super.key});

  @override
  Widget build(BuildContext context) => const Wrap(
    spacing: 8,
    children: [
      LegalLink(document: LegalDocument.privacy),
      LegalLink(document: LegalDocument.terms),
    ],
  );
}
