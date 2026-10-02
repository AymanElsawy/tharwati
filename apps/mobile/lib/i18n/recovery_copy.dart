import 'app_language.dart';

class RecoveryCopy {
  const RecoveryCopy({
    required this.resetEmailSubtitle,
    required this.title,
    required this.checking,
    required this.invalidLink,
    required this.transportError,
    required this.retry,
    required this.requestNewLink,
    required this.cancel,
    required this.updateError,
  });

  final String resetEmailSubtitle;
  final String title,
      checking,
      invalidLink,
      transportError,
      retry,
      requestNewLink,
      cancel,
      updateError;

  static RecoveryCopy of(AppLanguage language) => switch (language) {
    AppLanguage.en => _en,
    AppLanguage.ar => _ar,
  };

  static const _en = RecoveryCopy(
    title: "Choose a new password",
    checking: "Checking your reset link…",
    invalidLink:
        "This reset link is invalid or has expired. Request a new reset link.",
    transportError:
        "Could not check your reset link. Check your connection and retry.",
    retry: "Retry link",
    requestNewLink: "Request a new reset link",
    cancel: "Cancel recovery",
    updateError: "Could not update your password. Please try again.",
    resetEmailSubtitle:
        'We\u2019ll email a one-time link. It expires in 60 minutes.',
  );

  static const _ar = RecoveryCopy(
    title: "اختر كلمة مرور جديدة",
    checking: "جارٍ التحقق من رابط إعادة التعيين…",
    invalidLink:
        "رابط إعادة التعيين غير صالح أو انتهت صلاحيته. اطلب رابطًا جديدًا.",
    transportError:
        "تعذر التحقق من رابط إعادة التعيين. تحقق من اتصالك وحاول مجددًا.",
    retry: "إعادة محاولة الرابط",
    requestNewLink: "طلب رابط إعادة تعيين جديد",
    cancel: "إلغاء استعادة الحساب",
    updateError: "تعذر تحديث كلمة المرور. حاول مجددًا.",
    resetEmailSubtitle:
        'سنرسل رابطًا صالحًا للاستخدام مرة واحدة عبر البريد الإلكتروني. '
        'تنتهي صلاحيته خلال 60 دقيقة.',
  );
}
