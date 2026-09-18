import '../core/securities_allocation.dart';
import '../portfolio/portfolio_models.dart';
import 'app_language.dart';

class PortfolioCopy {
  const PortfolioCopy._(this.language);
  factory PortfolioCopy.of(AppLanguage language) => PortfolioCopy._(language);
  final AppLanguage language;
  bool get _ar => language == AppLanguage.ar;

  String get title => _ar ? 'تحليل المحفظة' : 'Portfolio Analysis';
  String get subtitle => _ar
      ? 'نظرة للقراءة فقط على استثمارات الوساطة والأوراق المالية.'
      : 'A read-only view of your Brokerage securities.';
  String get refresh => _ar ? 'تحديث' : 'Refresh';
  String get refreshing => _ar ? 'جارٍ تحديث الأدلة…' : 'Refreshing evidence…';
  String get fresh => _ar ? 'بيانات السوق محدثة' : 'Market data is current';
  String get stale => _ar
      ? 'تتضمن البيانات أسعارًا أو تحويلات قديمة'
      : 'Includes stale price or FX evidence';
  String get scope => _ar ? 'نطاق الوساطة' : 'Brokerage scope';
  String get allAccounts =>
      _ar ? 'كل حسابات الوساطة' : 'All Brokerage Accounts';
  String get summary => _ar ? 'ملخص المحفظة' : 'Portfolio Summary';
  String get invested =>
      _ar ? 'القيمة السوقية المستثمرة' : 'Invested Market Value';
  String get marketValue => _ar ? 'القيمة السوقية' : 'Market Value';
  String get costBasis => _ar ? 'أساس التكلفة' : 'Cost Basis';
  String get gainLoss =>
      _ar ? 'الربح/الخسارة غير المحققة' : 'Unrealized Gain/Loss';
  String get returnLabel => _ar ? 'العائد غير المحقق' : 'Unrealized Return';
  String get coverage => _ar ? 'تغطية التقييم' : 'Valuation coverage';
  String coverageValue(int valid, int total) =>
      _ar ? '$valid من $total أصل مقيم' : '$valid of $total holdings valued';
  String get cashTitle =>
      _ar ? 'النقد والقيمة الحالية' : 'Cash & Current Value';
  String get availableCash => _ar ? 'النقد المتاح' : 'Available Cash';
  String get currentValue => _ar ? 'القيمة الحالية' : 'Current Value';
  String get allocation =>
      _ar ? 'توزيع الأوراق المالية' : 'Securities Allocation';
  String get allocationNote =>
      _ar ? 'لا يشمل النقد المتاح.' : 'Available Cash is excluded.';
  String get holdings =>
      _ar ? 'المقتنيات حسب حساب الوساطة' : 'Holdings by Brokerage account';
  String get quantity => _ar ? 'الكمية' : 'Quantity';
  String get price => _ar ? 'السعر' : 'Price';
  String get unavailable => _ar ? 'غير متاح' : 'Unavailable';
  String get retry => _ar ? 'إعادة المحاولة' : 'Retry';
  String get loadFailed =>
      _ar ? 'تعذر تحميل تحليل المحفظة' : 'Portfolio analysis unavailable';
  String get loadFailedBody => _ar
      ? 'تحقق من الاتصال وحاول مرة أخرى.'
      : 'Check your connection and try again.';
  String get refreshFailed => _ar
      ? 'تعذر تحديث البيانات. ما زالت آخر بيانات صالحة معروضة.'
      : 'Refresh failed. The last valid data remains visible.';
  String get noAccounts =>
      _ar ? 'لا توجد حسابات وساطة نشطة' : 'No active Brokerage accounts';
  String get noAccountsBody => _ar
      ? 'أضف حساب وساطة من الحسابات للبدء.'
      : 'Add a Brokerage account from Accounts to begin.';
  String get openAccounts => _ar ? 'فتح الحسابات' : 'Open Accounts';
  String get empty =>
      _ar ? 'لا توجد أوراق مالية محتفظ بها' : 'No securities holdings';
  String get emptyBody => _ar
      ? 'قد يظل النقد المتاح ظاهرًا، لكنه لا يعد استثمارًا.'
      : 'Available Cash may still appear, but it is not an investment.';
  String get allocationEmpty =>
      _ar ? 'لا يوجد توزيع أوراق مالية بعد.' : 'No securities allocation yet.';
  String get incomplete => _ar ? 'التقييم غير مكتمل' : 'Incomplete valuation';
  String get incompleteBody => _ar
      ? 'هناك سعر أو سعر صرف مطلوب غير متاح. لا تُعرض الإجماليات الجزئية كإجماليات كاملة.'
      : 'A required price or FX rate is unavailable. Partial evidence is not presented as a complete total.';
  String get complete => _ar ? 'مكتمل' : 'Complete';
  String get partial => _ar ? 'جزئي' : 'Partial';
  String get unavailableStatus => _ar ? 'غير متاح' : 'Unavailable';
  String get emptyStatus => _ar ? 'فارغ' : 'Empty';
  String get staleBadge => _ar ? 'قديم' : 'Stale';
  String get viewAccount => _ar ? 'فتح الحساب' : 'Open account';

  String status(PortfolioCoverage value) => switch (value) {
    PortfolioCoverage.complete => complete,
    PortfolioCoverage.partial => partial,
    PortfolioCoverage.unavailable => unavailableStatus,
    PortfolioCoverage.empty => emptyStatus,
    PortfolioCoverage.noBrokerageAccounts => emptyStatus,
  };

  String allocationGroup(SecuritiesAllocationGroup group) => switch (group) {
    SecuritiesAllocationGroup.stocks => _ar ? 'الأسهم' : 'Stocks',
    SecuritiesAllocationGroup.etfs => _ar ? 'الصناديق المتداولة' : 'ETFs',
    SecuritiesAllocationGroup.bonds => _ar ? 'السندات' : 'Bonds',
    SecuritiesAllocationGroup.mutualFunds =>
      _ar ? 'صناديق الاستثمار' : 'Mutual Funds',
    SecuritiesAllocationGroup.cryptocurrency =>
      _ar ? 'العملات المشفرة' : 'Cryptocurrency',
    SecuritiesAllocationGroup.other => _ar ? 'أخرى' : 'Other',
  };
}
