import 'package:flutter/material.dart';

import '../i18n/app_language.dart';
import '../i18n/navigation_copy.dart';
import '../theme/tokens.dart';

/// Read-only navigation shells until the respective analysis data UI is built.
class WealthAnalysisPlaceholderPage extends StatelessWidget {
  const WealthAnalysisPlaceholderPage({super.key});

  @override
  Widget build(BuildContext context) {
    final copy = NavigationCopy.of(AppLanguageScope.of(context).language);
    return _AnalysisPlaceholderPage(
      title: copy.wealthAnalysis,
      message: copy.wealthAnalysisComingSoon,
    );
  }
}

class PortfolioAnalysisPlaceholderPage extends StatelessWidget {
  const PortfolioAnalysisPlaceholderPage({super.key});

  @override
  Widget build(BuildContext context) {
    final copy = NavigationCopy.of(AppLanguageScope.of(context).language);
    return _AnalysisPlaceholderPage(
      title: copy.portfolioAnalysis,
      message: copy.portfolioAnalysisComingSoon,
    );
  }
}

class _AnalysisPlaceholderPage extends StatelessWidget {
  const _AnalysisPlaceholderPage({required this.title, required this.message});

  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: c.canvas,
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: Text(message, style: TextStyle(color: c.inkMuted, fontSize: 14)),
      ),
    );
  }
}
