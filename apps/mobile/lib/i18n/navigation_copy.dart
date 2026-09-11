import 'app_language.dart';

class NavigationCopy {
  const NavigationCopy._(this.language);
  factory NavigationCopy.of(AppLanguage language) => NavigationCopy._(language);
  final AppLanguage language;
  bool get _ar => language == AppLanguage.ar;
  String get dashboard => _ar ? 'لوحة المعلومات' : 'Dashboard';
  String get accounts => _ar ? 'الحسابات' : 'Accounts';
  String get invest => _ar ? 'الاستثمار' : 'Invest';
  String get goals => _ar ? 'الأهداف' : 'Goals';
  String get settings => _ar ? 'الإعدادات' : 'Settings';
}
