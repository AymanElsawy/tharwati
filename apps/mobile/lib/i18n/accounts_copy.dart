import '../accounts/account_models.dart';
import 'app_language.dart';

/// Presentation-only copy for the mobile Accounts feature. Dynamic financial
/// values are isolated so Arabic labels retain their RTL ordering.
class AccountsCopy {
  const AccountsCopy._(this.language);
  factory AccountsCopy.of(AppLanguage language) => AccountsCopy._(language);

  final AppLanguage language;
  bool get _ar => language == AppLanguage.ar;
  String ltr(String value) => '\u2066$value\u2069';

  String get accounts => _ar ? 'الحسابات' : 'Accounts';
  String get financialAccounts =>
      _ar ? 'الحسابات المالية' : 'Financial accounts';
  String get accountsSubtitle => _ar
      ? 'أدر الحسابات التي تحفظ ثروتك وتنظمها.'
      : 'Manage the accounts that hold and organize your wealth.';
  String get addAccount => _ar ? 'إضافة حساب' : 'Add account';
  String get searchAccounts =>
      _ar ? 'ابحث باسم الحساب' : 'Search by account name';
  String get allAccountTypes => _ar ? 'كل أنواع الحسابات' : 'All account types';
  String get allCurrencies => _ar ? 'كل العملات' : 'All currencies';
  String get showClosed => _ar ? 'إظهار المغلقة' : 'Show Closed';
  String accountCount(int count) => _ar
      ? '${ltr('$count')} ${count == 1 ? 'حساب' : 'حسابات'}'
      : '$count ${count == 1 ? 'account' : 'accounts'}';
  String get sort => _ar ? 'فرز' : 'Sort';
  String get sortAccountName => _ar ? 'اسم الحساب' : 'Account name';
  String get sortType => _ar ? 'النوع' : 'Type';
  String get sortCurrentValue => _ar ? 'القيمة الحالية' : 'Current Value';
  String get closedArchived => _ar ? 'مغلق / مؤرشف' : 'Closed / Archived';
  String get sold => _ar ? 'مباع' : 'Sold';
  String get loadError =>
      _ar ? 'تعذر تحميل حساباتك' : 'We couldn’t load your accounts';
  String get unavailable => _ar ? 'غير متاح' : 'Unavailable';
  String get recordsSafe => _ar
      ? 'سجلاتك آمنة. اسحب للتحديث أو حاول مجددًا.'
      : 'Your records are safe. Pull to refresh or try again.';
  String get tryAgain => _ar ? 'حاول مجددًا' : 'Try again';
  String get addFirstAccount =>
      _ar ? 'أضف حسابك الأول' : 'Add your first account';
  String get noFilteredAccounts => _ar
      ? 'لا توجد حسابات تطابق عوامل التصفية.'
      : 'No accounts match your filters.';
  String get emptyDescription => _ar
      ? 'تتبّع النقد والبنوك والوساطة والذهب والعقارات والأعمال والحسابات الأخرى في مكان واحد.'
      : 'Track cash, bank, brokerage, gold, real estate, business, and other accounts in one place.';

  String accountType(AccountType type, {bool short = false}) => switch (type) {
    AccountType.cash => _ar ? 'نقد' : 'Cash',
    AccountType.bank => _ar ? 'بنك' : 'Bank',
    AccountType.brokerage =>
      _ar ? (short ? 'وساطة' : 'وساطة') : (short ? 'Broker' : 'Brokerage'),
    AccountType.gold =>
      _ar
          ? (short ? 'معادن' : 'ذهب وفضة')
          : (short ? 'Metals' : 'Gold & silver'),
    AccountType.realEstate =>
      _ar ? (short ? 'عقار' : 'عقارات') : (short ? 'Property' : 'Real estate'),
    AccountType.business => _ar ? 'أعمال' : 'Business',
    AccountType.other => _ar ? 'أخرى' : 'Other',
  };
  String bankSubtype(String? subtype) => subtype == 'credit'
      ? (_ar ? 'ائتمان بنكي' : 'Bank Credit')
      : (_ar ? 'خصم بنكي' : 'Bank Debit');
  String get gold => _ar ? 'ذهب' : 'Gold';
  String get silver => _ar ? 'فضة' : 'Silver';
  String get stocksEtfs => _ar ? 'أسهم وصناديق مؤشرات' : 'Stocks & ETFs';
  String get crypto => _ar ? 'عملات رقمية' : 'Crypto';
  String get mixed => _ar ? 'مختلط' : 'Mixed';
  String propertyType(String value) => switch (value) {
    'apartment' => _ar ? 'شقة' : 'Apartment',
    'villa' => _ar ? 'فيلا' : 'Villa',
    'land' => _ar ? 'أرض' : 'Land',
    'office' => _ar ? 'مكتب' : 'Office',
    _ => _ar ? 'أخرى' : 'Other',
  };
  String get limit => _ar ? 'الحد' : 'limit';
  String due(String value) => _ar ? 'الاستحقاق ${ltr(value)}' : 'due $value';
  String owned(String value) => _ar ? '${ltr(value)} مملوك' : '$value owned';
  String get closed => _ar ? 'مغلق' : 'CLOSED';
}
