import 'app_language.dart';

class NavigationCopy {
  const NavigationCopy._(this.language);
  factory NavigationCopy.of(AppLanguage language) => NavigationCopy._(language);
  final AppLanguage language;
  bool get _ar => language == AppLanguage.ar;
  String get dashboard => _ar ? 'لوحة المعلومات' : 'Dashboard';
  String get accounts => _ar ? 'الحسابات' : 'Accounts';
  String get analysis => _ar ? 'التحليل' : 'Analysis';
  String get wealthAnalysis => _ar ? 'تحليل الثروة' : 'Wealth Analysis';
  String get wealthAnalysisComingSoon =>
      _ar ? 'تحليل الثروة — قريبًا' : 'Wealth Analysis — coming soon';
  String get portfolioAnalysis => _ar ? 'تحليل المحفظة' : 'Portfolio Analysis';
  String get portfolioAnalysisComingSoon =>
      _ar ? 'تحليل المحفظة — قريبًا' : 'Portfolio Analysis — coming soon';
  String get goals => _ar ? 'الأهداف' : 'Goals';
  String get settings => _ar ? 'الإعدادات' : 'Settings';
}
