import 'app_language.dart';

class SettingsCopy {
  const SettingsCopy._(this.language);
  factory SettingsCopy.of(AppLanguage language) => SettingsCopy._(language);
  final AppLanguage language;
  bool get _ar => language == AppLanguage.ar;
  String get title => _ar ? 'الإعدادات' : 'Settings';
  String get profile => _ar ? 'الملف الشخصي' : 'PROFILE';
  String get preferences => _ar ? 'التفضيلات' : 'PREFERENCES';
  String get appearance => _ar ? 'المظهر' : 'APPEARANCE';
  String get session => _ar ? 'الجلسة' : 'SESSION';
  String get fullName => _ar ? 'الاسم الكامل' : 'Full name';
  String get fullNameHint => _ar ? 'اسمك الكامل' : 'Your full name';
  String get email => _ar ? 'البريد الإلكتروني' : 'Email';
  String get emailUnavailable =>
      _ar ? 'البريد الإلكتروني غير متاح' : 'Email unavailable';
  String get saveChanges => _ar ? 'حفظ التغييرات' : 'Save changes';
  String get saving => _ar ? 'جارٍ الحفظ…' : 'Saving…';
  String get profileUpdated =>
      _ar ? 'تم تحديث الملف الشخصي.' : 'Profile updated.';
  String get loadError => _ar
      ? 'تعذر تحميل ملفك الشخصي. حاول مجددًا.'
      : 'We couldn\'t load your profile. Try again.';
  String get saveError => _ar
      ? 'تعذر حفظ ملفك الشخصي. حاول مجددًا.'
      : 'We couldn\'t save your profile. Try again.';
  String get tryAgain => _ar ? 'حاول مجددًا' : 'Try again';
  String get languageLabel => _ar ? 'اللغة' : 'Language';
  String get appearanceLabel => _ar ? 'المظهر' : 'Appearance';
  String get light => _ar ? 'فاتح' : 'Light';
  String get dark => _ar ? 'داكن' : 'Dark';
  String get signOut => _ar ? 'تسجيل الخروج' : 'Sign out';
}
