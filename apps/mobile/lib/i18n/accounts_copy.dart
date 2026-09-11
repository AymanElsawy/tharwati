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

  // Create/edit account form.
  String get createAccountTitle => _ar ? 'إنشاء حساب' : 'Create account';
  String get editAccountTitle => _ar ? 'تعديل الحساب' : 'Edit account';
  String get accountCategoryHint => _ar
      ? 'اختر فئة الحساب التي تصف هذا الحساب بدقة.'
      : 'Select the account category that accurately describes this account.';
  String get accountTypeLabel => _ar ? 'نوع الحساب' : 'Account type';
  String get name => _ar ? 'الاسم' : 'Name';
  String get nameHint => _ar ? 'مثال: الحساب الرئيسي' : 'e.g. Main account';
  String get currency => _ar ? 'العملة' : 'Currency';
  String get currencyLockedHint => _ar
      ? 'يحتوي هذا الحساب بالفعل على سجل مالي. لا يمكن تغيير عملته.'
      : 'This account already contains financial history. Its currency cannot be changed.';
  String get balanceLockedHint => _ar
      ? 'يحتوي هذا الحساب بالفعل على سجل مالي. لا يمكن تغيير رصيده.'
      : 'This account already contains financial history. Its balance cannot be changed.';
  String get valuationDate => _ar ? 'تاريخ التقييم' : 'Valuation date';
  String get valuationMethod => _ar ? 'طريقة التقييم' : 'Valuation method';
  String get valuationNote => _ar ? 'ملاحظة التقييم' : 'Valuation note';
  String get descriptionNotes =>
      _ar ? 'الوصف / الملاحظات' : 'Description / Notes';
  String get cancel => _ar ? 'إلغاء' : 'Cancel';
  String get saving => _ar ? 'جارٍ الحفظ…' : 'Saving…';
  String get saveChanges => _ar ? 'حفظ التغييرات' : 'Save changes';
  String get type => _ar ? 'النوع' : 'Type';
  String get creditCardLimit =>
      _ar ? 'حد البطاقة الائتمانية' : 'Credit Card Limit';
  String get dueDayOfMonth =>
      _ar ? 'يوم الاستحقاق من الشهر' : 'Due Day of Month';
  String get investmentsType => _ar ? 'نوع الاستثمارات' : 'Type of investments';
  String get propertyTypeLabel => _ar ? 'نوع العقار' : 'Property type';
  String get location => _ar ? 'الموقع' : 'Location';
  String get businessType => _ar ? 'نوع النشاط التجاري' : 'Business type';
  String get specifyBusinessType =>
      _ar ? 'حدد نوع النشاط' : 'Specify business type';
  String get industry => _ar ? 'الصناعة' : 'Industry';
  String get specifyIndustry => _ar ? 'حدد الصناعة' : 'Specify industry';
  String get ownershipPercentage =>
      _ar ? 'نسبة الملكية' : 'Ownership percentage';
  String get selectOption => _ar ? 'اختر خيارًا' : 'Select an option';
  String get unset => _ar ? 'غير محدد' : 'Unset';
  String get noMatchingIndustries =>
      _ar ? 'لا توجد صناعات مطابقة' : 'No matching industries';

  String balanceLabelFor(AccountType type) => switch (type) {
    AccountType.brokerage =>
      _ar ? 'الرصيد النقدي المبدئي' : 'Starting cash balance',
    AccountType.realEstate ||
    AccountType.business => _ar ? 'القيمة الحالية' : 'Current value',
    _ => _ar ? 'الرصيد الحالي' : 'Current balance',
  };

  String currencyLabel(String code) {
    final name = switch (code) {
      'USD' => _ar ? 'الدولار الأمريكي' : 'US Dollar',
      'SAR' => _ar ? 'الريال السعودي' : 'Saudi Riyal',
      'EGP' => _ar ? 'الجنيه المصري' : 'Egyptian Pound',
      'EUR' => _ar ? 'اليورو' : 'Euro',
      'GBP' => _ar ? 'الجنيه الإسترليني' : 'British Pound',
      _ => code,
    };
    return _ar ? '${ltr(code)} — $name' : '$code — $name';
  }

  String bankOption(String code) => switch (code) {
    'credit' => _ar ? 'ائتمان' : 'Credit',
    _ => _ar ? 'خصم' : 'Debit',
  };
  String investmentOption(String code) => switch (code) {
    'stock_etf' => _ar ? 'أسهم وصناديق مؤشرات' : 'Stock & ETF',
    'crypto' => _ar ? 'عملات رقمية' : 'Crypto',
    _ => _ar ? 'أخرى' : 'Other',
  };
  String metalOption(String code) =>
      code == 'silver' ? (_ar ? 'فضة' : 'Silver') : (_ar ? 'ذهب' : 'Gold');
  String businessOption(String code) => switch (code) {
    'sole_proprietorship' => _ar ? 'مؤسسة فردية' : 'Sole Proprietorship',
    'partnership' => _ar ? 'شراكة' : 'Partnership',
    'llc' =>
      _ar ? 'شركة ذات مسؤولية محدودة' : 'Limited Liability Company (LLC)',
    'private_company' => _ar ? 'شركة خاصة' : 'Private Company',
    'family_owned' => _ar ? 'شركة عائلية' : 'Family-Owned Business',
    _ => _ar ? 'أخرى' : 'Other',
  };
  String industryOption(String code) => switch (code) {
    'retail' => _ar ? 'تجزئة' : 'Retail',
    'ecommerce' => _ar ? 'تجارة إلكترونية' : 'E-commerce',
    'food_beverage' => _ar ? 'أغذية ومشروبات' : 'Food & Beverage',
    'cosmetics_beauty' => _ar ? 'تجميل وعناية' : 'Cosmetics & Beauty',
    'healthcare' => _ar ? 'رعاية صحية' : 'Healthcare',
    'technology' => _ar ? 'تقنية' : 'Technology',
    'real_estate' => _ar ? 'عقارات' : 'Real Estate',
    'construction' => _ar ? 'إنشاءات' : 'Construction',
    'manufacturing' => _ar ? 'تصنيع' : 'Manufacturing',
    'education' => _ar ? 'تعليم' : 'Education',
    'professional_services' => _ar ? 'خدمات مهنية' : 'Professional Services',
    'financial_services' => _ar ? 'خدمات مالية' : 'Financial Services',
    'logistics_transportation' =>
      _ar ? 'لوجستيات ونقل' : 'Logistics & Transportation',
    'hospitality_tourism' => _ar ? 'ضيافة وسياحة' : 'Hospitality & Tourism',
    'agriculture' => _ar ? 'زراعة' : 'Agriculture',
    _ => _ar ? 'أخرى' : 'Other',
  };

  String validation(String message) => switch (message) {
    'Name is required' => _ar ? 'الاسم مطلوب' : message,
    'Balance is required' => _ar ? 'الرصيد مطلوب' : message,
    'Enter a non-negative amount with up to 2 decimal places' =>
      _ar ? 'أدخل مبلغًا غير سالب حتى منزلتين عشريتين' : message,
    'Select debit or credit' => _ar ? 'اختر خصمًا أو ائتمانًا' : message,
    'Enter a positive credit card limit with up to 2 decimal places' =>
      _ar ? 'أدخل حدًا ائتمانيًا موجبًا حتى منزلتين عشريتين' : message,
    'Select a due day from 1 through 31' =>
      _ar ? 'اختر يوم استحقاق من 1 إلى 31' : message,
    'Current balance cannot exceed the credit card limit' =>
      _ar ? 'لا يمكن أن يتجاوز الرصيد الحالي حد البطاقة الائتمانية' : message,
    'Select a type of investment' => _ar ? 'اختر نوع الاستثمار' : message,
    'Select gold or silver' => _ar ? 'اختر الذهب أو الفضة' : message,
    'Ownership percentage is required' => _ar ? 'نسبة الملكية مطلوبة' : message,
    'Enter a value between 0 and 100' => _ar ? 'أدخل قيمة بين 0 و100' : message,
    'Select a property type' => _ar ? 'اختر نوع العقار' : message,
    'Business type is required' => _ar ? 'نوع النشاط التجاري مطلوب' : message,
    'Specify the business type' => _ar ? 'حدد نوع النشاط التجاري' : message,
    'Industry is required' => _ar ? 'الصناعة مطلوبة' : message,
    'Specify the industry' => _ar ? 'حدد الصناعة' : message,
    'Valuation date is required' => _ar ? 'تاريخ التقييم مطلوب' : message,
    'Valuation date cannot be in the future' =>
      _ar ? 'لا يمكن أن يكون تاريخ التقييم في المستقبل' : message,
    _ => message,
  };

  String get accountUnavailable => _ar
      ? 'هذا الحساب لم يعد متاحًا.'
      : 'This account is no longer available.';
  String get edit => _ar ? 'تعديل' : 'Edit';
  String get editAccount => _ar ? 'تعديل الحساب' : 'Edit account';
  String get closeAccount => _ar ? 'إغلاق الحساب' : 'Close account';
  String get reopenAccount => _ar ? 'إعادة فتح الحساب' : 'Reopen account';
  String get delete => _ar ? 'حذف' : 'Delete';
  String get currentValue => _ar ? 'القيمة الحالية' : 'CURRENT VALUE';
  String get creditSummary => _ar ? 'ملخص الائتمان' : 'Credit summary';
  String get creditLimit => _ar ? 'حد الائتمان' : 'Credit limit';
  String get availableCredit => _ar ? 'الائتمان المتاح' : 'Available credit';
  String get amountDue => _ar ? 'المبلغ المستحق' : 'Amount due';
  String latestValuationOwnership(String value) => _ar
      ? 'أحدث تقييم × ${ltr(value)}% ملكية'
      : 'Latest valuation × $value% ownership';
  String paymentDueDay(String day) => _ar
      ? 'يستحق الدفع في اليوم ${ltr(day)} من كل شهر'
      : 'Payment due on day $day each month';
  String lifecycleTitle(String action, String name) => switch (action) {
    'close' => _ar ? 'إغلاق «$name»؟' : 'Close “$name”?',
    'reopen' => _ar ? 'إعادة فتح «$name»؟' : 'Reopen “$name”?',
    _ => _ar ? 'حذف «$name»؟' : 'Delete “$name”?',
  };
  String lifecycleBody(String action) => switch (action) {
    'close' =>
      _ar
          ? 'سيحتفظ بكل سجله ويغادر القائمة النشطة وصافي الثروة. يمكنك إعادة فتحه لاحقًا.'
          : 'It keeps all its history and leaves the active list and net worth. You can reopen it later.',
    'reopen' =>
      _ar
          ? 'سيعود إلى القائمة النشطة وصافي الثروة.'
          : 'It returns to the active list and net worth.',
    _ =>
      _ar
          ? 'سيؤدي ذلك إلى إزالة الحساب نهائيًا. لا يمكن ذلك إلا عند عدم وجود سجل مالي.'
          : 'This permanently removes the account. Only possible while it has no financial history.',
  };
  String lifecycleAction(String action) => switch (action) {
    'close' => _ar ? 'إغلاق' : 'Close',
    'reopen' => _ar ? 'إعادة فتح' : 'Reopen',
    _ => delete,
  };

  // Valued account detail, valuation, and disposal presentation.
  String get financialAccountsHeading =>
      _ar ? 'الحسابات المالية' : 'FINANCIAL ACCOUNTS';
  String get attributableValue =>
      _ar ? 'قيمتك المنسوبة' : 'Your attributable value';
  String get accountDetails => _ar ? 'تفاصيل الحساب' : 'Account details';
  String get valuationHistory => _ar ? 'سجل التقييمات' : 'Valuation history';
  String get saleHistory => _ar ? 'سجل المبيعات' : 'Sale history';
  String get updateValue => _ar ? 'تحديث القيمة' : 'Update value';
  String get markAsSold => _ar ? 'تحديد كمباع' : 'Mark as sold';
  String get sellOwnership => _ar ? 'بيع الملكية' : 'Sell ownership';
  String get fullValue => _ar ? 'القيمة الكاملة' : 'Full value';
  String fullValueWithAmount(String value) =>
      _ar ? '$fullValue: ${ltr(value)}' : '$fullValue: $value';
  String soldOwnership(String value) =>
      _ar ? 'تم بيع ${ltr(value)}' : '$value sold';
  String get businessTypeLabel => _ar ? 'نوع النشاط' : 'Business type';
  String get ownershipPercentageLabel =>
      _ar ? 'نسبة الملكية' : 'Ownership percentage';
  String get unavailableAccountData => _ar ? 'غير متاح' : 'Unavailable';
  String get updateCurrentValue =>
      _ar ? 'تحديث القيمة الحالية' : 'Update current value';
  String get currentValueLabel => _ar ? 'القيمة الحالية' : 'Current value';
  String get valuationDateLabel => _ar ? 'تاريخ التقييم' : 'Valuation date';
  String get valuationMethodLabel => _ar ? 'طريقة التقييم' : 'Valuation method';
  String get valuationNoteLabel => _ar ? 'ملاحظة التقييم' : 'Valuation note';
  String get valuationDateRequired =>
      _ar ? 'تاريخ التقييم مطلوب' : 'Valuation date is required';
  String get valuationDateFuture => _ar
      ? 'لا يمكن أن يكون تاريخ التقييم في المستقبل'
      : 'Valuation date cannot be in the future';
  String get unexpectedError =>
      _ar ? 'حدث خطأ غير متوقع' : 'An unexpected error occurred';
  String get saleAmountReceived =>
      _ar ? 'مبلغ البيع المستلم' : 'Sale amount received';
  String get saleCurrency => _ar ? 'عملة البيع' : 'Sale currency';
  String get saleDestination =>
      _ar ? 'إلى أين ذهبت الأموال؟' : 'Where did the money go?';
  String get noEligibleDestination => _ar
      ? 'لا يوجد حساب نقدي أو بنكي نشط بهذه العملة.'
      : 'No active Cash or Bank account uses this currency.';
  String get selectCashOrBank =>
      _ar ? 'اختر حسابًا نقديًا أو بنكيًا' : 'Select a Cash or Bank account';
  String destinationAccount(String name, AccountType type) =>
      '$name · ${accountType(type)}';
  String propertySaleExitsOwnership(String value) => _ar
      ? 'ينهي هذا البيع ملكيتك المتبقية البالغة ${ltr(value)}.'
      : 'This sale exits your remaining $value ownership.';
  String get ownershipSold =>
      _ar ? 'الملكية المباعة (%)' : 'Ownership sold (%)';
  String get saleDate => _ar ? 'تاريخ البيع' : 'Sale date';
  String get saleNote => _ar ? 'ملاحظة البيع' : 'Sale note';
  String get validSaleAmount => _ar
      ? 'أدخل مبلغ بيع صالحًا غير سالب.'
      : 'Enter a valid non-negative sale amount.';
  String get saleDestinationRequired => _ar
      ? 'اختر مكان إيداع عائدات البيع.'
      : 'Select where the sale proceeds were deposited.';

  String propertyTypeValue(String? value) {
    if (value == null || value.isEmpty) return unavailable;
    return propertyType(value);
  }

  String businessTypeValue(String? value) =>
      _classificationValue(value, businessOption);

  String industryValue(String? value) =>
      _classificationValue(value, industryOption);

  String _classificationValue(
    String? value,
    String Function(String) knownLabel,
  ) {
    if (value == null || value.isEmpty) return unavailable;
    if (value.startsWith('other:')) return value.substring('other:'.length);
    return knownLabel(value);
  }
}
