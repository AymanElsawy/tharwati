import 'app_language.dart';

class LoginCopy {
  const LoginCopy({
    required this.email,
    required this.password,
    required this.emailRequired,
    required this.passwordRequired,
    required this.forgotPassword,
    required this.signIn,
    required this.newToTharwati,
    required this.createAccount,
    required this.incorrectCredentials,
    required this.genericError,
    required this.english,
    required this.arabic,
    required this.showPassword,
    required this.hidePassword,
  });

  final String email;
  final String password;
  final String emailRequired;
  final String passwordRequired;
  final String forgotPassword;
  final String signIn;
  final String newToTharwati;
  final String createAccount;
  final String incorrectCredentials;
  final String genericError;
  final String english;
  final String arabic;
  final String showPassword;
  final String hidePassword;

  static LoginCopy of(AppLanguage language) => switch (language) {
    AppLanguage.en => _en,
    AppLanguage.ar => _ar,
  };

  static const _en = LoginCopy(
    email: 'Email',
    password: 'Password',
    emailRequired: 'Enter your email',
    passwordRequired: 'Enter your password',
    forgotPassword: 'Forgot password?',
    signIn: 'Sign in',
    newToTharwati: 'New to Tharwati? ',
    createAccount: 'Create an account',
    incorrectCredentials: 'Incorrect email or password.',
    genericError: 'Something went wrong. Please try again.',
    english: 'English',
    arabic: 'العربية',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
  );

  static const _ar = LoginCopy(
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    emailRequired: 'أدخل بريدك الإلكتروني',
    passwordRequired: 'أدخل كلمة المرور',
    forgotPassword: 'هل نسيت كلمة المرور؟',
    signIn: 'تسجيل الدخول',
    newToTharwati: 'جديد في ثروتي؟ ',
    createAccount: 'إنشاء حساب',
    incorrectCredentials: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    genericError: 'حدث خطأ. حاول مرة أخرى.',
    english: 'English',
    arabic: 'العربية',
    showPassword: 'إظهار كلمة المرور',
    hidePassword: 'إخفاء كلمة المرور',
  );
}
