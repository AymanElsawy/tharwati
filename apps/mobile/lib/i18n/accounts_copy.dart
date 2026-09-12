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
  String accountTypeCurrencyCaption(
    AccountType type,
    String currency, {
    String? bankSubtype,
  }) {
    final label = type == AccountType.bank
        ? this.bankSubtype(bankSubtype)
        : accountType(type);
    return _ar ? '$label · ${ltr(currency)}' : '$label · $currency';
  }

  String get cashBankLedgerHelper => _ar
      ? 'سيظهر سجل الدخل والمصروفات والتحويلات الكامل لهذا الحساب في مسار لاحق. القيمة أعلاه معدلة بحسب السجل.'
      : 'The full income / expense / transfer ledger for this account arrives in a later flow. The value above is ledger-adjusted.';
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

  // Cash/Bank account records read surface.
  String get accountRecords => _ar ? 'سجلات الحساب' : 'Account records';
  String get addRecord => _ar ? 'إضافة سجل' : 'Add record';
  String get searchRecords =>
      _ar ? 'ابحث في الملاحظات والفئات' : 'Search notes and categories';
  String get filters => _ar ? 'عوامل التصفية' : 'Filters';
  String filtersCount(int count) =>
      _ar ? 'عوامل التصفية (${ltr('$count')})' : 'Filters ($count)';
  String get recordsLoadError =>
      _ar ? 'تعذر تحميل سجلات الحساب.' : 'We couldn’t load account records.';
  String get noAccountRecords =>
      _ar ? 'لا توجد سجلات للحساب بعد.' : 'No account records yet.';
  String get loadMore => _ar ? 'تحميل المزيد' : 'Load more';
  String get creditSummaryUnavailable => _ar
      ? 'ملخص الائتمان غير متاح حتى تكون قيمة حد الائتمان والائتمان المتاح صحيحة.'
      : 'Credit summary is unavailable until the credit limit and available credit are valid.';
  String get dueDay => _ar ? 'يوم الاستحقاق' : 'Due Day';
  String get notSet => _ar ? 'غير محدد' : 'Not set';
  String dayValue(String value) => _ar ? 'اليوم ${ltr(value)}' : 'Day $value';
  String get recordType => _ar ? 'نوع السجل' : 'Record type';
  String get allRecordTypes => _ar ? 'كل الأنواع' : 'All types';
  String recordTypeValue(String value) => switch (value) {
    'income' => _ar ? 'دخل' : 'Income',
    'expense' => _ar ? 'مصروف' : 'Expense',
    'transfer' => _ar ? 'تحويل' : 'Transfer',
    _ => value,
  };
  String get from => _ar ? 'من' : 'From';
  String get to => _ar ? 'إلى' : 'To';
  String get mainCategory => _ar ? 'الفئة الرئيسية' : 'Main category';
  String get subcategory => _ar ? 'الفئة الفرعية' : 'Subcategory';
  String get allCategories => _ar ? 'كل الفئات' : 'All categories';
  String get allSubcategories =>
      _ar ? 'كل الفئات الفرعية' : 'All subcategories';
  String get minAmount => _ar ? 'الحد الأدنى للمبلغ' : 'Min amount';
  String get maxAmount => _ar ? 'الحد الأقصى للمبلغ' : 'Max amount';
  String get clearAll => _ar ? 'مسح الكل' : 'Clear all';
  String get apply => _ar ? 'تطبيق' : 'Apply';
  String get any => _ar ? 'أي' : 'Any';

  // Cash/Bank record write and category-management presentation.
  String get editRecord => _ar ? 'تعديل السجل' : 'Edit record';
  String get deleteRecord => _ar ? 'حذف السجل' : 'Delete record';
  String get deleteRecordTitle => _ar ? 'حذف السجل؟' : 'Delete record?';
  String get deleteRecordBody => _ar
      ? 'سيُزال السجل من سجلك وسيُحدَّث رصيد حسابك.'
      : 'This will remove the record from your history. Your account balances will be updated.';
  String get account => _ar ? 'الحساب' : 'Account';
  String get fromAccount => _ar ? 'من الحساب' : 'From account';
  String get toAccount => _ar ? 'إلى الحساب' : 'To account';
  String get amount => _ar ? 'المبلغ' : 'Amount';
  String get amountSent => _ar ? 'المبلغ المُرسل' : 'Amount sent';
  String get amountReceived => _ar
      ? 'المبلغ المتوقع / المستلم فعليًا'
      : 'Expected / actual amount received';
  String get dateTime => _ar ? 'التاريخ والوقت' : 'Date & time';
  String get notes => _ar ? 'ملاحظات' : 'Notes';
  String get saveRecord => _ar ? 'حفظ السجل' : 'Save record';
  String get chooseCategory => _ar ? 'اختر فئة' : 'Choose a category';
  String get category => _ar ? 'الفئة' : 'Category';
  String get manageCategories => _ar ? 'إدارة الفئات' : 'Manage categories';
  String get searchCategories => _ar ? 'ابحث في الفئات' : 'Search categories';
  String get noMatchingCategories =>
      _ar ? 'لا توجد فئات مطابقة.' : 'No matching categories.';
  String get manageCategoriesTitle =>
      _ar ? 'إدارة الفئات' : 'Manage categories';
  String get categoryName => _ar ? 'اسم الفئة' : 'Category name';
  String get addUnder => _ar ? 'إضافة ضمن' : 'Add under';
  String get addMainCategory => _ar ? 'إضافة فئة رئيسية' : 'Add main category';
  String addSubcategory(String name) =>
      _ar ? 'إضافة فئة فرعية: $name' : 'Add subcategory: $name';
  String get categoriesLoadError =>
      _ar ? 'تعذر تحميل الفئات.' : 'We couldn’t load categories.';
  String get close => _ar ? 'إغلاق' : 'Close';
  String get rename => _ar ? 'إعادة تسمية' : 'Rename';
  String get hide => _ar ? 'إخفاء' : 'Hide';
  String get restoreDefault => _ar ? 'استعادة الافتراضي' : 'Restore default';
  String get archive => _ar ? 'أرشفة' : 'Archive';
  String get hidden => _ar ? 'مخفي' : 'Hidden';
  String recordAccountPicker(String name, AccountType type, String currency) =>
      _ar
      ? '$name — ${accountType(type)} — ${ltr(currency)}'
      : '$name — ${accountType(type)} — $currency';
  String? recordValidation(String? message) => switch (message) {
    'Select an account.' => _ar ? 'اختر حسابًا.' : message,
    'Enter a positive amount with up to 2 decimal places.' =>
      _ar ? 'أدخل مبلغًا موجبًا حتى منزلتين عشريتين.' : message,
    'Date and time are required.' => _ar ? 'التاريخ والوقت مطلوبان.' : message,
    'Category is required.' => _ar ? 'الفئة مطلوبة.' : message,
    'From and to accounts must be different.' =>
      _ar ? 'يجب أن يختلف الحساب المصدر عن الحساب الوجهة.' : message,
    _ => message,
  };
  // Metal purity-detail presentation.
  String purity(String value) => value == 'other'
      ? (_ar ? 'أخرى' : 'Other')
      : (_ar ? ltr(value.toUpperCase()) : value.toUpperCase());
  String get currentMetalValue => _ar ? 'القيمة الحالية' : 'Current value';
  String get weight => _ar ? 'الوزن' : 'Weight';
  String get cost => _ar ? 'التكلفة' : 'Cost';
  String get pricePerGram => _ar ? 'السعر / غرام' : 'Price / gram';
  String get purchases => _ar ? 'المشتريات' : 'Purchases';
  String purchasesCount(int count) =>
      _ar ? '$purchases · ${ltr('$count')}' : 'PURCHASES · $count';
  String get purityLoadError =>
      _ar ? 'تعذر تحميل هذا العيار' : 'We couldn’t load this purity';
  String get puritySafeError => _ar
      ? 'تعذر تحميل هذا العيار. سجلاتك آمنة.'
      : 'We couldn’t load this purity. Your records are safe.';
  String get noPurityPurchases => _ar
      ? 'لا توجد مشتريات متبقية بهذا العيار.'
      : 'No purchases remain at this purity.';
  String gainVsCost(String value) =>
      _ar ? '${ltr(value)} مقارنة بالتكلفة' : '$value vs cost';
  String purchasePaid(String total, String perGram) => _ar
      ? 'دُفع ${ltr(total)} · ${ltr('$perGram/g')}'
      : 'Paid $total · $perGram/g';
  String nowValue(String value) => _ar ? 'الآن ${ltr(value)}' : 'Now $value';
  String get reversePurchase => _ar ? 'عكس' : 'Reverse';
  String get reversePurchaseTitle =>
      _ar ? 'عكس عملية الشراء هذه؟' : 'Reverse this purchase?';
  String reversePurchaseBody(String weight, String amount) => _ar
      ? 'سيؤدي هذا إلى عكس ${ltr(weight)} و${ltr(amount)} من التكلفة. ستبقى عملية الشراء في السجل مع تمييزها كعملية معكوسة، وسيُعاد المبلغ إلى حساب التمويل إن وُجد.'
      : 'This backs out $weight and $amount of cost. The purchase stays in the ledger, marked reversed, and any funding account is credited back.';

  // Metal purchase add/edit presentation.
  String get addMetalPurchase => _ar ? 'إضافة عملية شراء' : 'Add purchase';
  String get editMetalPurchase => _ar ? 'تعديل عملية الشراء' : 'Edit purchase';
  String get purityLabel => _ar ? 'العيار' : 'Purity';
  String get addMetalPurchaseSubtitle => _ar
      ? 'يسجل عملية شراء غير قابلة للتعديل ويحدّث متوسط التكلفة المرجّح.'
      : 'Records an immutable purchase and updates the weighted-average cost.';
  String get editMetalPurchaseSubtitle => _ar
      ? 'يحفظ نسخة مصححة من عملية الشراء هذه. يبقى الأصل في السجل بوصفه مستبدلًا.'
      : 'Saves a corrected version of this purchase. The original stays in the ledger, superseded.';
  String get select => _ar ? 'اختر' : 'Select';
  String get purchaseDateTime =>
      _ar ? 'تاريخ ووقت الشراء' : 'Purchase date & time';
  String get grams => _ar ? 'الغرامات' : 'Grams';
  String get costPerGram => _ar ? 'التكلفة / غرام' : 'Cost / gram';
  String get fees => _ar ? 'الرسوم' : 'Fees';
  String get purchaseSubtotal =>
      _ar ? 'إجمالي الشراء الفرعي' : 'Purchase subtotal';
  String get totalCost => _ar ? 'إجمالي التكلفة' : 'Total cost';
  String get paidFrom => _ar ? 'دُفع من' : 'Paid from';
  String get paidFromCashBank =>
      _ar ? 'دُفع من حساب نقدي / بنكي' : 'Paid from a Cash / Bank account';
  String get noSameCurrencyFundingAccount => _ar
      ? 'لا يوجد حساب نقدي أو بنكي بالعملة نفسها'
      : 'No same-currency Cash/Bank account';
  String fundingAccountOption(String name, AccountType type) =>
      _ar ? '$name · ${accountType(type)}' : '$name · ${accountType(type)}';
  String? metalPurchaseValidation(String? message) => switch (message) {
    'Choose a purity for this metal.' =>
      _ar ? 'اختر عيارًا لهذا المعدن.' : message,
    'Enter the purchase date and time.' =>
      _ar ? 'أدخل تاريخ ووقت الشراء.' : message,
    'Grams must be a positive number (up to 3 decimals).' =>
      _ar ? 'يجب أن تكون الغرامات رقمًا موجبًا حتى 3 منازل عشرية.' : message,
    'Cost per gram must be greater than zero.' =>
      _ar ? 'يجب أن تكون التكلفة لكل غرام أكبر من صفر.' : message,
    'Fees must be zero or more.' =>
      _ar ? 'يجب أن تكون الرسوم صفرًا أو أكثر.' : message,
    'Choose the account you paid from.' =>
      _ar ? 'اختر الحساب الذي دُفع منه.' : message,
    _ => message,
  };

  // Gold/Silver account-detail presentation.
  String metalName(String? value) => switch (value) {
    'silver' => _ar ? 'فضة' : 'Silver',
    'gold' => _ar ? 'ذهب' : 'Gold',
    _ => _ar ? 'معدن' : 'Metal',
  };
  String metalTypeCurrencyCaption(String? metalType, String currency) => _ar
      ? '${metalName(metalType)} · ${ltr(currency)}'
      : '${metalName(metalType)} · $currency';
  String get liveMetalPriceUnavailable => _ar
      ? 'سعر المعدن المباشر غير متاح الآن'
      : 'Live metal price unavailable right now';
  String liveMetalPriceCaption(String? metalType) => _ar
      ? 'الوزن × سعر ${metalName(metalType)} المباشر'
      : 'Weight × the live ${metalName(metalType).toLowerCase()} price';
  String get metal => _ar ? 'المعدن' : 'METAL';
  String get totalCostLabel => _ar ? 'إجمالي التكلفة' : 'TOTAL COST';
  String get unrealizedGain => _ar ? 'ربح غير محقق' : 'Unrealized gain';
  String get unrealizedLoss => _ar ? 'خسارة غير محققة' : 'Unrealized loss';
  String get byPurity => _ar ? 'حسب العيار' : 'By purity';
  String get purityBreakdownDescription => _ar
      ? 'تُقيّم كل درجة نقاء بسعر السوق مضروبًا في معامل النقاوة.'
      : 'Each purity is valued at the spot price scaled by its fineness.';
  String purchaseCount(int count) => _ar
      ? '${ltr('$count')} ${count == 1 ? 'عملية شراء' : 'عمليات شراء'}'
      : '$count ${count == 1 ? 'purchase' : 'purchases'}';
  String get purchaseHistory => _ar ? 'سجل المشتريات' : 'Purchase history';
  String get appendOnly => _ar ? 'إضافي فقط' : 'APPEND-ONLY';
  String get noMetalPurchases => _ar
      ? 'لا توجد مشتريات بعد. أضف عملية لبدء احتساب متوسط التكلفة المرجّح.'
      : 'No purchases yet. Add one to start the weighted-average cost.';
  String get purchaseCorrectionHelp => _ar
      ? 'يمكن إضافة المشتريات فقط؛ صحح واحدة بإضافة قيد تعديل.'
      : 'Purchases can be added but never edited or deleted — correct one by appending an adjusting entry.';
  String metalPurchaseDate(int day, int month, int year) {
    const englishMonths = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const arabicMonths = [
      'يناير',
      'فبراير',
      'مارس',
      'أبريل',
      'مايو',
      'يونيو',
      'يوليو',
      'أغسطس',
      'سبتمبر',
      'أكتوبر',
      'نوفمبر',
      'ديسمبر',
    ];
    final monthName = (_ar ? arabicMonths : englishMonths)[month - 1];
    return _ar
        ? '${ltr('$day')} $monthName ${ltr('$year')}'
        : '$day $monthName $year';
  }

  // Brokerage read/detail presentation.
  String get brokerage => _ar ? 'الوساطة' : 'Brokerage';
  String get brokerageLoadError =>
      _ar ? 'تعذر تحميل هذا الحساب' : 'We couldn’t load this account';
  String get brokerageSafeError => _ar
      ? 'ممتلكاتك آمنة. اسحب للتحديث أو حاول مجددًا.'
      : 'Your holdings are safe. Pull to refresh or try again.';
  String get buy => _ar ? 'شراء' : 'Buy';
  String get buyMore => _ar ? 'شراء المزيد' : 'Buy more';
  String get sell => _ar ? 'بيع' : 'Sell';
  String get dividend => _ar ? 'توزيعات' : 'Dividend';
  String holdingsCount(int count) =>
      _ar ? 'الممتلكات · ${ltr('$count')}' : 'HOLDINGS · $count';
  String get noInvestments =>
      _ar ? 'لا توجد استثمارات بعد' : 'No investments yet';
  String get noInvestmentsDescription => _ar
      ? 'سجل عملية شراء لبدء تتبع ممتلكات هذا الحساب وقيمتها السوقية.'
      : 'Record a buy to start tracking this account’s holdings and their market value.';
  String get activity => _ar ? 'النشاط' : 'ACTIVITY';
  String get activityLoadError => _ar
      ? 'تعذر تحميل نشاط هذا الحساب. لا تتأثر ممتلكاتك المعروضة أعلاه.'
      : 'We couldn’t load this account’s activity. Your holdings above are unaffected.';
  String get noActivity => _ar ? 'لا يوجد نشاط بعد.' : 'No activity yet.';
  String get updated => _ar ? 'محدّث' : 'UPDATED';
  String get removed => _ar ? 'مزال' : 'REMOVED';
  String activityUnits(String value) =>
      _ar ? '${ltr(value)} وحدات' : '$value units';
  String signedMoneyWithPercent(String money, String percent) =>
      _ar ? '${ltr(money)} · ${ltr(percent)}' : '$money · $percent';
  String localizedDate(String isoDate) {
    final parts = isoDate.split('-');
    if (parts.length != 3) return isoDate;
    final year = int.tryParse(parts[0]);
    final month = int.tryParse(parts[1]);
    final day = int.tryParse(parts[2]);
    if (year == null ||
        month == null ||
        day == null ||
        month < 1 ||
        month > 12) {
      return isoDate;
    }
    return metalPurchaseDate(day, month, year);
  }

  String get availableCash => _ar ? 'النقد المتاح' : 'Available cash';
  String get holdingsMarketValue =>
      _ar ? 'القيمة السوقية للممتلكات' : 'Holdings market value';
  String get holdingsCost => _ar ? 'تكلفة الممتلكات' : 'Holdings cost';
  String incompleteHoldings(int count) => _ar
      ? '${ltr('$count')} ${count == 1 ? 'ممتلكة لا تملك' : 'ممتلكات لا تملك'} سعرًا حاليًا، لذا لا يمكن إكمال الإجماليات أعلاه. تبقى أرقام التكلفة دقيقة.'
      : '$count ${count == 1 ? 'holding has' : 'holdings have'} no current price, so the totals above can’t be completed. Cost figures are still exact.';
  String get quantity => _ar ? 'الكمية' : 'Quantity';
  String get price => _ar ? 'السعر' : 'Price';
  String get marketValue => _ar ? 'القيمة السوقية' : 'Market value';
  String get averageCost => _ar ? 'متوسط التكلفة' : 'Average cost';
  String get currentPrice => _ar ? 'السعر الحالي' : 'Current price';
  String get noCurrentPrice =>
      _ar ? 'لا يتوفر سعر حالي' : 'No current price available';
  String get holding => _ar ? 'ممتلكة' : 'Holding';
  String get positionNoLongerOpen =>
      _ar ? 'لم تعد هذه الممتلكة مفتوحة.' : 'This position is no longer open.';
  String get history => _ar ? 'السجل' : 'HISTORY';
  String get holdingHistoryLoadError => _ar
      ? 'تعذر تحميل سجل هذه الممتلكة.'
      : 'We couldn’t load this position’s history.';
  String get noHoldingHistory => _ar ? 'لا يوجد سجل بعد.' : 'No history yet.';
  String get existingHolding => _ar ? 'ممتلكة قائمة' : 'Existing holding';
  String get stalePrice => _ar
      ? 'هذا السعر قديم؛ لم يقم المزوّد بتحديثه مؤخرًا.'
      : 'This price is stale — the provider hasn’t refreshed it recently.';
  String get remove => _ar ? 'إزالة' : 'Remove';
  String get removeExistingHoldingTitle =>
      _ar ? 'إزالة هذه الممتلكة القائمة؟' : 'Remove this existing holding?';
  String get removeExistingHoldingBody => _ar
      ? 'يبقى القيد في السجل مع تمييزه كقيد معكوس، وتُعاد الكمية وأساس التكلفة إلى وضعهما السابق.'
      : 'The entry stays in the ledger marked reversed, and the position’s quantity and cost basis are adjusted back.';
  String get editExistingHolding =>
      _ar ? 'تعديل الممتلكة القائمة' : 'Edit existing holding';
  String get editExistingHoldingSubtitle => _ar
      ? 'يحفظ نسخة مصححة. يبقى الأصل في السجل بوصفه مستبدلًا.'
      : 'Saves a corrected version. The original stays in the ledger, superseded.';
  String exchangeRateTo(String currency) =>
      _ar ? 'سعر الصرف إلى ${ltr(currency)}' : 'Exchange rate to $currency';
  String get optional => _ar ? 'اختياري' : 'Optional';
  String? existingHoldingValidation(String? message) => switch (message) {
    'Enter a quantity greater than zero.' =>
      _ar ? 'أدخل كمية أكبر من صفر.' : message,
    'Enter an average cost greater than zero.' =>
      _ar ? 'أدخل متوسط تكلفة أكبر من صفر.' : message,
    'Enter the exchange rate.' => _ar ? 'أدخل سعر الصرف.' : message,
    _ => message,
  };
  String brokerageActivityLabel(
    String code, {
    required bool incoming,
    required bool reinvested,
    required bool partiallyReinvested,
  }) => switch (code) {
    'buy' => buy,
    'sell' => sell,
    'opening_position' => existingHolding,
    'dividend' when partiallyReinvested =>
      _ar ? 'توزيعات معاد استثمارها جزئيًا' : 'Dividend partially reinvested',
    'dividend' when reinvested =>
      _ar ? 'توزيعات معاد استثمارها' : 'Dividend reinvested',
    'dividend' => dividend,
    _ =>
      incoming
          ? (_ar ? 'تحويل وارد' : 'Transfer in')
          : (_ar ? 'تحويل صادر' : 'Transfer out'),
  };

  // Brokerage trade and dividend presentation.
  String get instrument => _ar ? 'الأداة المالية' : 'Instrument';
  String get searchOrChooseHolding =>
      _ar ? 'ابحث أو اختر أصلًا مملوكًا' : 'Search or choose a holding';
  String get chooseHolding => _ar ? 'اختر أصلًا مملوكًا' : 'Choose a holding';
  String get unitPrice => _ar ? 'سعر الوحدة' : 'Unit price';
  String get unitSalePrice => _ar ? 'سعر بيع الوحدة' : 'Unit sale price';
  String get buyTradeSubtitle => _ar
      ? 'يسجل عملية شراء ويخصم قيمتها من نقد هذا الحساب.'
      : 'Records a purchase and debits this account’s cash.';
  String get sellTradeSubtitle => _ar
      ? 'يسجل عملية بيع ويضيف قيمتها إلى نقد هذا الحساب.'
      : 'Records a sale and credits this account’s cash.';
  String get purchaseAmount => _ar ? 'قيمة الشراء' : 'Purchase amount';
  String get grossProceeds => _ar ? 'إجمالي المتحصلات' : 'Gross proceeds';
  String get netProceeds => _ar ? 'صافي المتحصلات' : 'Net proceeds';
  String get cashDebited => _ar ? 'النقد المخصوم' : 'Cash debited';
  String get cashCredited => _ar ? 'النقد المضاف' : 'Cash credited';
  String get recordBuy => _ar ? 'تسجيل الشراء' : 'Record buy';
  String get recordSell => _ar ? 'تسجيل البيع' : 'Record sell';
  String get chooseInstrument =>
      _ar ? 'اختر أداة مالية' : 'Choose an instrument';
  String get buyInstrumentPickerSubtitle => _ar
      ? 'اختر أصلًا تملكه بالفعل أو ابحث عن أداة جديدة.'
      : 'Pick something you already hold, or search for a new one.';
  String get sellInstrumentPickerSubtitle => _ar
      ? 'يمكنك بيع ما يملكه هذا الحساب فقط.'
      : 'You can only sell what this account holds.';
  String get searchByNameOrSymbol =>
      _ar ? 'ابحث بالاسم أو الرمز' : 'Search by name or symbol';
  String get filterYourHoldings =>
      _ar ? 'تصفية أصولك المملوكة' : 'Filter your holdings';
  String get yourHoldings => _ar ? 'أصولك المملوكة' : 'YOUR HOLDINGS';
  String get searchResults => _ar ? 'نتائج البحث' : 'SEARCH RESULTS';
  String get typeTwoCharacters => _ar
      ? 'اكتب حرفين على الأقل للبحث.'
      : 'Type at least two characters to search.';
  String get noInstrumentsMatched =>
      _ar ? 'لا توجد أدوات مطابقة.' : 'No instruments matched.';
  String get noOpenHoldingsToSell => _ar
      ? 'لا يملك هذا الحساب أصولًا مفتوحة للبيع.'
      : 'This account has no open holdings to sell.';
  String currencyValue(String value) => _ar ? ltr(value) : value;
  String symbolValue(String value) => _ar ? ltr(value) : value;
  String instrumentCaption(String? symbol, String name) =>
      symbol == null ? name : '${symbolValue(symbol)} · $name';
  String holdingPickerCaption(String name, String quantity, String unit) =>
      _ar ? '$name · ${ltr('$quantity $unit')}' : '$name · $quantity $unit';
  String assetSearchCaption(String name, String exchange, String currency) =>
      _ar
      ? '$name · ${ltr(exchange)} · ${ltr(currency)}'
      : '$name · $exchange · $currency';
  String tradeExchangeRate(String from, String to) => _ar
      ? 'سعر الصرف · ${ltr('1 $from')} إلى ${ltr(to)}'
      : 'Exchange rate · 1 $from to $to';
  String? tradeValidation(String? message) {
    if (!_ar || message == null) return message;
    final held = RegExp(r'^You only hold (.+)\.$').firstMatch(message);
    if (held != null) return 'لا تملك سوى ${ltr(held.group(1)!)}.';
    return switch (message) {
      'Choose an instrument.' => 'اختر أداة مالية.',
      'Enter a quantity greater than zero.' => 'أدخل كمية أكبر من صفر.',
      'Enter a price greater than zero.' => 'أدخل سعرًا أكبر من صفر.',
      'Fees must be zero or more.' => 'يجب أن تكون الرسوم صفرًا أو أكثر.',
      'Date and time are required.' => 'التاريخ والوقت مطلوبان.',
      'Enter the exchange rate for this trade.' =>
        'أدخل سعر الصرف لهذه العملية.',
      _ => message,
    };
  }

  String get reinvestDividend =>
      _ar ? 'إعادة استثمار التوزيعات' : 'Reinvest dividend';
  String get partiallyReinvestDividend =>
      _ar ? 'إعادة استثمار جزئي للتوزيعات' : 'Partially reinvest dividend';
  String get dividendSubtitle => _ar
      ? 'تُسجل بعملة الحساب، وتُخصم الضرائب والرسوم من المبلغ الإجمالي.'
      : 'Recorded in the account currency. Tax and fees come out of the gross amount.';
  String get settlement => _ar ? 'التسوية' : 'Settlement';
  String get cash => _ar ? 'نقدًا' : 'Cash';
  String get reinvestAll => _ar ? 'إعادة استثمار الكل' : 'Reinvest all';
  String get partial => _ar ? 'جزئي' : 'Partial';
  String get grossDividend => _ar ? 'إجمالي التوزيعات' : 'Gross dividend';
  String get withholdingTax => _ar ? 'ضريبة الاستقطاع' : 'Withholding tax';
  String get amountReinvested =>
      _ar ? 'المبلغ المعاد استثماره' : 'Amount reinvested';
  String get restStaysAsCash =>
      _ar ? 'يبقى الباقي نقدًا' : 'The rest stays as cash';
  String get reinvestmentPricePerUnit =>
      _ar ? 'سعر إعادة الاستثمار للوحدة' : 'Reinvestment price per unit';
  String get gross => _ar ? 'الإجمالي' : 'Gross';
  String get tax => _ar ? 'الضريبة' : 'Tax';
  String get netDividend => _ar ? 'صافي التوزيعات' : 'Net dividend';
  String get cashRemainder => _ar ? 'المتبقي نقدًا' : 'Cash remainder';
  String get unitsAdded => _ar ? 'الوحدات المضافة' : 'Units added';
  String get recordDividend => _ar ? 'تسجيل التوزيعات' : 'Record dividend';
  String? dividendValidation(String? message) => switch (message) {
    'Choose the instrument that paid the dividend.' =>
      _ar ? 'اختر الأداة التي دفعت التوزيعات.' : message,
    'This instrument is priced in a different currency than the account. Dividends must be recorded in the account currency.' =>
      _ar
          ? 'تُسعّر هذه الأداة بعملة مختلفة عن الحساب. يجب تسجيل التوزيعات بعملة الحساب.'
          : message,
    'Enter the gross dividend.' => _ar ? 'أدخل إجمالي التوزيعات.' : message,
    'Withholding tax must be zero or more.' =>
      _ar ? 'يجب أن تكون ضريبة الاستقطاع صفرًا أو أكثر.' : message,
    'Fees must be zero or more.' =>
      _ar ? 'يجب أن تكون الرسوم صفرًا أو أكثر.' : message,
    'Tax and fees leave nothing to record.' =>
      _ar ? 'لم يتبق مبلغ للتسجيل بعد الضريبة والرسوم.' : message,
    'Date and time are required.' => _ar ? 'التاريخ والوقت مطلوبان.' : message,
    'Enter the reinvestment price per unit.' =>
      _ar ? 'أدخل سعر إعادة الاستثمار للوحدة.' : message,
    'Enter the amount being reinvested.' =>
      _ar ? 'أدخل المبلغ المعاد استثماره.' : message,
    'Must be less than the net dividend. Reinvest all of it with “Reinvest all” instead.' =>
      _ar
          ? 'يجب أن يكون أقل من صافي التوزيعات. استخدم «إعادة استثمار الكل» بدلًا من ذلك.'
          : message,
    _ => message,
  };
}
