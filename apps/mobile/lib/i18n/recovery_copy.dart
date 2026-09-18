import 'app_language.dart';

class RecoveryCopy {
  const RecoveryCopy({required this.resetEmailSubtitle});

  final String resetEmailSubtitle;

  static RecoveryCopy of(AppLanguage language) => switch (language) {
    AppLanguage.en => _en,
    AppLanguage.ar => _ar,
  };

  static const _en = RecoveryCopy(
    resetEmailSubtitle:
        'We\u2019ll email a one-time link. It expires in 60 minutes.',
  );

  static const _ar = RecoveryCopy(
    resetEmailSubtitle:
        'سنرسل رابطًا صالحًا للاستخدام مرة واحدة عبر البريد الإلكتروني. '
        'تنتهي صلاحيته خلال 60 دقيقة.',
  );
}
