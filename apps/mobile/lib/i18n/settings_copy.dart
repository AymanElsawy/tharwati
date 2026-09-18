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
  String get dangerZone => _ar ? 'منطقة الخطر' : 'DANGER ZONE';
  String get deleteAccount => _ar ? 'حذف الحساب' : 'Delete account';
  String get deleteAccountSummary => _ar
      ? 'يحذف حسابك وبياناتك المالية نهائيًا. لا يمكن التراجع عن هذا الإجراء.'
      : 'Permanently delete your account and financial data. This cannot be undone.';
  String get deleteDialogTitle =>
      _ar ? 'حذف الحساب نهائيًا؟' : 'Permanently delete account?';
  String get deletePasswordDescription => _ar
      ? 'أدخل كلمة المرور الحالية للتحقق من هويتك.'
      : 'Enter your current password to verify your identity.';
  String get deleteConfirmationDescription => _ar
      ? 'هذه هي الخطوة الأخيرة. أكد البريد الإلكتروني للمتابعة.'
      : 'This is the final step. Confirm your email to continue.';
  String get deletePermanentWarning => _ar
      ? 'سيتم حذف الحساب وجميع البيانات المالية المرتبطة به نهائيًا.'
      : 'Your account and all associated financial data will be permanently deleted.';
  String get currentPassword =>
      _ar ? 'كلمة المرور الحالية' : 'Current password';
  String get typeEmailInstruction => _ar
      ? 'اكتب البريد الإلكتروني التالي بالضبط:'
      : 'Type the following email exactly:';
  String get confirmEmail => _ar ? 'تأكيد البريد الإلكتروني' : 'Confirm email';
  String get cancel => _ar ? 'إلغاء' : 'Cancel';
  String get continueAction => _ar ? 'متابعة' : 'Continue';
  String get checkingPassword => _ar ? 'جارٍ التحقق…' : 'Checking…';
  String get deletingAccount => _ar ? 'جارٍ حذف الحساب…' : 'Deleting account…';
  String get wrongPassword => _ar
      ? 'كلمة المرور غير صحيحة. حاول مرة أخرى.'
      : 'That password is incorrect. Try again.';
  String get sessionExpired => _ar
      ? 'انتهت جلستك. سجل الدخول مرة أخرى.'
      : 'Your session expired. Sign in again.';
  String get deleteFailed => _ar
      ? 'تعذر حذف الحساب. لم يتم تأكيد أي حذف.'
      : 'Account deletion failed. No deletion was confirmed.';
  String get deleteUncertain => _ar
      ? 'تعذر تأكيد نتيجة الطلب. سجل الدخول وتحقق قبل المحاولة مرة أخرى.'
      : 'We could not confirm the request result. Sign in and verify before trying again.';
}
