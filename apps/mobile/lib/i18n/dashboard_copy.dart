import 'app_language.dart';
import '../dashboard/logic/key_insights.dart';

class DashboardCopy {
  const DashboardCopy._(this.language);

  factory DashboardCopy.of(AppLanguage language) => DashboardCopy._(language);

  final AppLanguage language;
  bool get _ar => language == AppLanguage.ar;
  String ltr(String value) => '\u2066$value\u2069';

  String get finishSetup => _ar ? 'أكمل الإعداد' : 'Finish setting up';
  String get baseCurrencyMessage => _ar
      ? 'اختر بلدك وعملة الأساس لعرض صافي ثروتك.'
      : 'Pick your country and base currency to see your net worth.';
  String get completeOnboarding =>
      _ar ? 'إكمال الإعداد الأولي' : 'Complete onboarding';
  String get valuesUnavailable =>
      _ar ? 'قيم لوحة المعلومات غير متاحة' : 'Dashboard values unavailable';
  String get serverUnavailable => _ar
      ? 'تعذر الاتصال بالخادم. سجلاتك آمنة ولم تتغير.'
      : 'We couldn\'t reach the server. Your records are safe and unchanged.';
  String get retry => _ar ? 'إعادة المحاولة' : 'Retry';
  String get loadingNetWorth =>
      _ar ? 'جارٍ تحميل صافي ثروتك…' : 'Loading your net worth…';
  String get wealthAtGlance =>
      _ar ? 'ثروتك في لمحة' : 'Your wealth at a glance';
  String greeting(String name, int hour, {required bool welcome}) {
    final lead = welcome
        ? (_ar ? 'مرحبًا' : 'Welcome')
        : _ar
        ? (hour < 12
              ? 'صباح الخير'
              : hour < 18
              ? 'مساء الخير'
              : 'مساء الخير')
        : (hour < 12
              ? 'Good morning'
              : hour < 18
              ? 'Good afternoon'
              : 'Good evening');
    return name.isEmpty ? lead : '$lead، $name';
  }

  String date(DateTime date) {
    const enMonths = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    const enDays = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ];
    const arMonths = [
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
    const arDays = [
      'الاثنين',
      'الثلاثاء',
      'الأربعاء',
      'الخميس',
      'الجمعة',
      'السبت',
      'الأحد',
    ];
    final months = _ar ? arMonths : enMonths;
    final days = _ar ? arDays : enDays;
    return _ar
        ? '${days[date.weekday - 1]}، ${ltr('${date.day}')} ${months[date.month - 1]}'
        : '${days[date.weekday - 1]}, ${date.day} ${months[date.month - 1]}';
  }

  String get totalNetWorth => _ar ? 'إجمالي صافي الثروة' : 'TOTAL NET WORTH';
  String accountsSummary(int count, String currency) => _ar
      ? 'عبر ${ltr('$count')} ${count == 1 ? 'حساب' : 'حسابات'} · ${ltr(currency)}'
      : 'Across $count ${count == 1 ? 'account' : 'accounts'} · $currency';
  String get accountSumHint =>
      _ar ? 'مجموع الحسابات التي تضيفها' : 'Sum of the accounts you add';
  String get assets => _ar ? 'الأصول' : 'ASSETS';
  String get liabilities => _ar ? 'الالتزامات' : 'LIABILITIES';
  String get accounts => _ar ? 'الحسابات' : 'ACCOUNTS';
  String get totalsUnavailable =>
      _ar ? 'الإجماليات غير متاحة' : 'Totals unavailable';
  String get missingRate => _ar
      ? 'سعر صرف مفقود، لذلك لا يمكننا جمع حساباتك الآن. لا نعرض قيماً جزئية.'
      : 'An exchange rate is missing, so we can’t total your accounts right now. Nothing partial is shown.';
  String get missingValue => _ar
      ? 'يوجد حساب واحد أو أكثر بلا قيمة حالية، لذلك لا يمكننا جمع صافي ثروتك. لا نعرض قيماً جزئية.'
      : 'One or more accounts have no current value yet, so we can’t total your net worth. Nothing partial is shown.';
  String get nothingTracked => _ar
      ? 'لا يوجد شيء متتبَّع بعد. صافي ثروتك هو مجموع الحسابات التي تضيفها.'
      : 'Nothing tracked yet. Your net worth is the sum of the accounts you add.';
  String get addFirstAccount =>
      _ar ? 'أضف حسابك الأول' : 'Add your first account';
  String get noBreakdown => _ar ? 'لا يوجد توزيع بعد' : 'No breakdown yet';
  String get breakdownEmpty => _ar
      ? 'يظهر التوزيع عندما يحتوي حساب واحد على الأقل على قيمة.'
      : 'Allocation appears once at least one account holds a value.';
  String get breakdownUnavailable => _ar
      ? 'التوزيع غير متاح طالما أن قيمة أو سعر صرف مفقود.'
      : 'Breakdown is unavailable while a value or exchange rate is missing.';
  String get assetsBreakdown => _ar ? 'توزيع الأصول' : 'Assets breakdown';
  String get total => _ar ? 'الإجمالي' : 'TOTAL';
  String assetGroup(String group) => switch (group) {
    'cashAndBank' => _ar ? 'النقد والبنوك' : 'Cash & bank',
    'brokerage' => _ar ? 'الوساطة' : 'Brokerage',
    'goldAndSilver' => _ar ? 'الذهب والفضة' : 'Gold & silver',
    'realEstate' => _ar ? 'العقارات' : 'Real estate',
    'business' => _ar ? 'الأعمال' : 'Business',
    'certificates' => _ar ? 'الشهادات' : 'Certificates',
    _ => _ar ? 'أخرى' : 'Other',
  };
  String get allocationUnavailable => _ar
      ? 'التوزيع غير متاح طالما يتعذر تقييم أحد المقتنيات. لا نعرض قيماً جزئية.'
      : 'Allocation is unavailable while a holding can’t be valued. Nothing partial is shown.';
  String get noBrokerage => _ar
      ? 'لا توجد مقتنيات وساطة إيجابية لعرضها بعد.'
      : 'No positive Brokerage holdings to display yet.';
  String get portfolioAllocation =>
      _ar ? 'توزيع المحفظة' : 'Portfolio allocation';
  String get brokerageSubtitle => _ar
      ? 'استثمارات الوساطة الحالية حسب نوع الأصل'
      : 'Current Brokerage investments by asset type';
  String get invested => _ar ? 'مستثمر' : 'INVESTED';
  String get goals => _ar ? 'الأهداف' : 'Goals';
  String activeGoals(int count) =>
      _ar ? 'للقراءة فقط · ${ltr('$count')} نشطة' : 'Read-only · $count active';
  String get viewAll => _ar ? 'عرض الكل' : 'View all';
  String get goalsHint => _ar
      ? 'تُتبع يدويًا — الأهداف لا تغيّر صافي ثروتك.'
      : 'Tracked by hand — goals never change your net worth.';
  String get goalsLoadError =>
      _ar ? 'تعذر تحميل أهدافك.' : 'Couldn’t load your goals.';
  String get noActiveGoals =>
      _ar ? 'لا توجد أهداف نشطة الآن.' : 'No active goals right now.';
  String get noGoals => _ar
      ? 'تتبع الأهداف المدخرات بشكل مستقل — ولا تغيّر صافي ثروتك.'
      : 'Goals track savings on their own — they never change your net worth.';
  String get viewAllGoals => _ar ? 'عرض كل الأهداف' : 'View all goals';
  String get createGoal => _ar ? 'إنشاء هدف' : 'Create a goal';
  String due(String date) => _ar ? 'الموعد ${ltr(date)}' : 'Due $date';
  String overdue(String date) =>
      _ar ? 'متأخر · ${ltr(date)}' : 'Overdue · $date';
  String overTarget(String amount) =>
      _ar ? '${ltr(amount)} فوق الهدف' : '$amount over target';
  String get keyInsights => _ar ? 'أهم الرؤى' : 'Key insights';
  String get dataQuality => _ar ? 'جودة البيانات' : 'Data quality';
  String insightTitle(InsightTone tone) => switch (tone) {
    InsightTone.incomplete =>
      _ar ? 'بعض القيم مفقودة' : 'Some values are missing',
    InsightTone.stale =>
      _ar ? 'قد تكون القيم غير محدّثة' : 'Values may be out of date',
    InsightTone.empty => _ar ? 'لا توجد حسابات بعد' : 'No accounts yet',
    InsightTone.ready =>
      _ar ? 'قيم لوحة المعلومات متاحة' : 'Dashboard values are available',
  };
  String insightBody(InsightTone tone) => switch (tone) {
    InsightTone.incomplete =>
      _ar
          ? 'يوجد حساب واحد أو أكثر بلا قيمة حالية أو سعر صرف، لذلك لا تتوفر إجماليات لوحة المعلومات بدلاً من القيم الجزئية.'
          : 'One or more accounts have no current value or exchange rate, so the dashboard totals are unavailable rather than partial.',
    InsightTone.stale =>
      _ar
          ? 'استخدم آخر تقييم سعراً أو سعراً صرف غير محدّث. حدّث عند استقرار الاتصال.'
          : 'The latest valuation used a stale price or rate. Refresh once your connection is stable.',
    InsightTone.empty =>
      _ar
          ? 'أضف حسابًا لعرض صافي ثروتك وتوزيعك.'
          : 'Add an account to see your net worth and allocation.',
    InsightTone.ready =>
      _ar
          ? 'لكل حساب نشط قيمة حالية بعملة الأساس.'
          : 'Every active account has a current value in your base currency.',
  };
}
