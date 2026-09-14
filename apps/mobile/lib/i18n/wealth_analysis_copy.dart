import '../analysis/domain/wealth_target_allocation.dart';
import '../dashboard/logic/dashboard_aggregate.dart';
import 'app_language.dart';

class WealthAnalysisCopy {
  const WealthAnalysisCopy._(this.language);

  factory WealthAnalysisCopy.of(AppLanguage language) =>
      WealthAnalysisCopy._(language);

  final AppLanguage language;
  bool get _ar => language == AppLanguage.ar;
  String ltr(String value) => '\u2066$value\u2069';

  String get pageTitle => _ar ? 'تحليل الثروة' : 'Wealth Analysis';
  String get pageSubtitle => _ar
      ? 'رؤية تحليلية شاملة لثروتك وتوزيعها الحالي.'
      : 'A deeper view of your wealth and its current allocation.';
  String get loading => _ar ? 'جارٍ تحليل ثروتك…' : 'Analyzing your wealth…';
  String get loadError =>
      _ar ? 'تعذر تحميل تحليل الثروة' : 'Wealth Analysis is unavailable';
  String get loadErrorBody => _ar
      ? 'تعذر الوصول إلى بيانات التقييم الآن. لم تتغير سجلاتك.'
      : 'We couldn’t load valuation data right now. Your records are unchanged.';
  String get refreshError =>
      _ar ? 'تعذر تحديث تحليل الثروة' : 'Wealth Analysis could not refresh';
  String get refreshErrorBody => _ar
      ? 'نعرض آخر بيانات تم تحميلها بنجاح. حاول التحديث مرة أخرى.'
      : 'The last successfully loaded analysis remains visible. Try refreshing again.';
  String get retry => _ar ? 'إعادة المحاولة' : 'Retry';
  String get emptyTitle =>
      _ar ? 'لا توجد ثروة محللة بعد' : 'Nothing to analyze yet';
  String get emptyBody => _ar
      ? 'أضف حسابًا بقيمة حالية لبدء تحليل ثروتك.'
      : 'Add an account with a current value to begin your wealth analysis.';

  String get healthEyebrow => _ar ? 'الصحة المالية' : 'WEALTH HEALTH';
  String get healthTitle =>
      _ar ? 'وضع ثروتك الحالي' : 'Your current wealth position';
  String get healthDescription => _ar
      ? 'ملخص نوعي لجودة التقييم والسيولة والالتزامات، دون درجة أو توصيات.'
      : 'A qualitative view of valuation quality, cash exposure, and liabilities—without a score or advice.';
  String healthSynthesis({required bool incomplete, required bool stale}) {
    if (incomplete) {
      return _ar
          ? 'بعض القيم المطلوبة لم تُحل، لذلك تظل هذه صورة محدودة بدلًا من تقدير جزئي.'
          : 'Some required values are unresolved, so this remains a limited view rather than a partial estimate.';
    }
    if (stale) {
      return _ar
          ? 'تقدم بيانات الأصول والالتزامات المتاحة صورة استرشادية، لكن لقطة التقييم قد تكون قديمة.'
          : 'The available asset and liability evidence provides a directional view, but the valuation snapshot may be out of date.';
    }
    return _ar
        ? 'تعكس قيم الأصول والالتزامات الحالية سياق صافي الثروة المعروض هنا.'
        : 'Your current asset values and liabilities support the net wealth context shown here.';
  }

  String get netWealth => _ar ? 'صافي الثروة' : 'Net wealth';
  String get valuation => _ar ? 'التقييم' : 'Valuation';
  String get cashExposure => _ar ? 'النقد والبنوك' : 'Cash & Bank exposure';
  String get liabilities => _ar ? 'الالتزامات' : 'Liabilities';
  String get complete => _ar ? 'مكتمل' : 'Complete';
  String get incomplete => _ar ? 'غير مكتمل' : 'Incomplete';
  String get unavailable => _ar ? 'غير متاح' : 'Unavailable';

  String get attentionEyebrow => _ar ? 'انتباه' : 'ATTENTION';
  String get attentionTitle => _ar ? 'ملخص الانتباه' : 'Attention Summary';
  String get noObservations =>
      _ar ? 'لا توجد ملاحظات جوهرية' : 'No material observations';
  String get noObservationsBody => _ar
      ? 'لا تظهر بيانات التقييم الحالية حالة تستدعي الانتباه.'
      : 'Current valuation evidence shows no condition requiring attention.';
  String get incompleteAttention =>
      _ar ? 'بعض القيم غير مكتملة' : 'Some values are incomplete';
  String unresolvedSources(int count) => _ar
      ? 'تعذر تقييم ${ltr('$count')} من المصادر بموثوقية.'
      : '$count valuation ${count == 1 ? 'source is' : 'sources are'} unresolved.';
  String get staleAttention =>
      _ar ? 'قد تكون القيم غير محدثة' : 'Values may be out of date';
  String get staleAttentionBody => _ar
      ? 'تعرض اللقطة الحالية آخر بيانات موثوقة متاحة.'
      : 'The current snapshot is using the latest reliable data available.';

  String get allocationEyebrow => _ar ? 'التوزيع الحالي' : 'CURRENT ALLOCATION';
  String get allocationTitle => _ar ? 'توزيع الثروة' : 'Wealth Allocation';
  String get allocationDescription => _ar
      ? 'توزيع كامل للقيمة الموثوقة بين فئات الأصول المدعومة.'
      : 'The full reliably valued total across supported asset classes.';
  String get valuedTotal => _ar ? 'الإجمالي المُقيّم' : 'Valued total';
  String get completeCoverage =>
      _ar ? '100% من التوزيع المشمول' : '100% of included allocation';
  String get allocationUnavailable => _ar
      ? 'التوزيع غير متاح حتى تكتمل جميع القيم وأسعار الصرف المطلوبة.'
      : 'Allocation is unavailable until every required value and FX rate is reliable.';
  String get allocationEmpty =>
      _ar ? 'لا توجد قيم موجبة لعرضها.' : 'No positive values to display.';
  String get largestExposure => _ar ? 'أكبر انكشاف' : 'Largest exposure';
  String largestExposureBody(String assetClass, String percentage) => _ar
      ? '$assetClass تمثل ${ltr(percentage)} من الثروة المُقيّمة.'
      : '$assetClass represents $percentage of valued wealth.';

  String get targetEyebrow => _ar ? 'الهيكل المختار' : 'SELECTED STRUCTURE';
  String get targetTitle =>
      _ar ? 'التوزيع المستهدف والانحراف' : 'Target Allocation & Drift';
  String get targetDescription => _ar
      ? 'قارن توزيعك الحالي بالهدف الذي اخترته.'
      : 'Compare your current valued allocation with your selected target.';
  String get editTarget => _ar ? 'تعديل الهدف' : 'Edit target';
  String get setTarget => _ar ? 'تحديد هدف' : 'Set target';
  String get noTarget => _ar
      ? 'حدد توزيعًا مستهدفًا لعرض المقارنة.'
      : 'Set a target allocation to see the comparison.';
  String get targetUnavailable => _ar
      ? 'مقارنة الهدف غير متاحة لأن إحدى القيم المشاركة غير موثوقة.'
      : 'Target comparison is unavailable because a participating value is not reliable.';
  String get current => _ar ? 'الحالي' : 'Current';
  String get target => _ar ? 'الهدف' : 'Target';
  String get gap => _ar ? 'الفجوة' : 'Gap';
  String get status => _ar ? 'الحالة' : 'Status';
  String driftStatus(WealthTargetDriftStatus status) => switch (status) {
    WealthTargetDriftStatus.above =>
      _ar ? '↑ أعلى من النطاق المستهدف' : '↑ Above target range',
    WealthTargetDriftStatus.below =>
      _ar ? '↓ أقل من النطاق المستهدف' : '↓ Below target range',
    WealthTargetDriftStatus.within =>
      _ar ? '✓ ضمن النطاق المستهدف' : '✓ Within target range',
  };
  String get allWithin => _ar
      ? 'جميع الفئات المشاركة ضمن نطاقاتها المستهدفة.'
      : 'All participating asset classes are within their target ranges.';
  String largestDeviation(
    String assetClass,
    String percentage,
    WealthTargetDriftStatus status,
    String money,
  ) {
    final direction = status == WealthTargetDriftStatus.above
        ? (_ar ? 'أعلى من هدفك المختار' : 'above your selected target')
        : (_ar ? 'أقل من هدفك المختار' : 'below your selected target');
    return _ar
        ? '$assetClass لديها أكبر انحراف عن الهدف: ${ltr(percentage)} $direction، ما يعادل تقريبًا ${ltr(money)}.'
        : '$assetClass has the largest target deviation: $percentage $direction, equivalent to approximately $money.';
  }

  String excludedTargets(List<String> classes) {
    final names = classes.join(_ar ? ' و' : ', ');
    return _ar
        ? '$names تحتفظ بقيمة حالية موثوقة لكنها مستبعدة من توزيعك المستهدف.'
        : '$names currently hold reliable value but are excluded from your target allocation.';
  }

  String get editorTitle =>
      _ar ? 'تعديل التوزيع المستهدف' : 'Edit target allocation';
  String get editorDescription => _ar
      ? 'أدخل نسبة لكل فئة أصول. يجب أن يكون الإجمالي 100% بالضبط.'
      : 'Enter a percentage for every asset class. The total must be exactly 100%.';
  String get zeroExclusion => _ar
      ? 'هدف 0% يستبعد الفئة وقيمتها الحالية من مقارنة الهدف.'
      : 'A 0% target excludes that class and its current value from comparison.';
  String get tolerance => _ar ? 'هامش السماح' : 'Tolerance';
  String toleranceSummary(String formattedValue) => _ar
      ? 'هامش السماح ${ltr('±$formattedValue')}'
      : 'Tolerance ±$formattedValue';
  String get zeroToleranceHelper => _ar
      ? 'هامش 0% يعني أن التطابق التام مع هدفك فقط يُعد ضمن النطاق.'
      : '0% means only an exact match to your target is within range.';
  String toleranceHelper(String value) => _ar
      ? 'القيمة الواقعة ضمن ${ltr('±$value')} من هدفك تُعد ضمن النطاق.'
      : 'An allocation within ±$value of your target is within range.';
  String get toleranceError => _ar
      ? 'أدخل نسبة من 0% إلى 100% وبحد أقصى 6 منازل عشرية.'
      : 'Enter a percentage from 0% to 100% with up to 6 decimal places.';
  String get total => _ar ? 'الإجمالي' : 'Total';
  String get totalError => _ar
      ? 'يجب أن يكون مجموع نسب الأهداف 100% بالضبط.'
      : 'Target percentages must total exactly 100%.';
  String get save => _ar ? 'حفظ الهدف' : 'Save target';
  String get saving => _ar ? 'جارٍ الحفظ…' : 'Saving…';
  String get cancel => _ar ? 'إلغاء' : 'Cancel';
  String get saveError => _ar
      ? 'تعذر حفظ التوزيع المستهدف. حاول مرة أخرى.'
      : 'Your target allocation could not be saved. Try again.';

  String assetGroup(AssetGroup group) => switch (group) {
    AssetGroup.cashAndBank => _ar ? 'النقد والبنوك' : 'Cash & Bank',
    AssetGroup.brokerage => _ar ? 'الوساطة' : 'Brokerage',
    AssetGroup.goldAndSilver => _ar ? 'الذهب والفضة' : 'Gold & Silver',
    AssetGroup.realEstate => _ar ? 'العقارات' : 'Real Estate',
    AssetGroup.business => _ar ? 'الأعمال' : 'Business',
    AssetGroup.other => _ar ? 'أخرى' : 'Other',
    AssetGroup.certificates => _ar ? 'الشهادات' : 'Certificates',
  };
}
