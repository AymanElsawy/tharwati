import 'app_language.dart';

class GoalsCopy {
  const GoalsCopy._(this.language);
  factory GoalsCopy.of(AppLanguage language) => GoalsCopy._(language);
  final AppLanguage language;
  bool get _ar => language == AppLanguage.ar;

  // Direction-safe financial and date formatting.
  String ltr(String value) => '\u2066$value\u2069';
  String formatDate(String iso) {
    final parts = iso.split('T').first.split('-');
    if (parts.length != 3) return iso;
    final month = (int.tryParse(parts[1]) ?? 1).clamp(1, 12) - 1;
    const en = [
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
    const ar = [
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
    final months = _ar ? ar : en;
    return '${parts[2]} ${months[month]} ${parts[0]}';
  }

  // List, filters, and empty/loading states.
  String get goals => _ar ? 'الأهداف' : 'Goals';
  String get addGoal => _ar ? 'إضافة هدف' : 'Add goal';
  String get subtitle => _ar
      ? 'مدخرات تُتبع يدويًا · صافي الثروة لا يتغير'
      : 'Savings tracked by hand · net worth untouched';
  String current(int count) =>
      _ar ? 'الحالية · ${ltr('$count')}' : 'Current · $count';
  String archived(int count) =>
      _ar ? 'المؤرشفة · ${ltr('$count')}' : 'Archived · $count';
  String get loadError =>
      _ar ? 'تعذر تحميل أهدافك' : 'Couldn’t load your goals';
  String get safeRecords => _ar
      ? 'سجلاتك آمنة. اسحب للتحديث أو حاول مجددًا.'
      : 'Your records are safe. Pull to refresh or try again.';
  String get retry => _ar ? 'إعادة المحاولة' : 'Retry';
  String get noArchived => _ar
      ? 'لا توجد أهداف مؤرشفة. تحتفظ الأهداف المؤرشفة بسجلها الكامل — لا يُحذف شيء.'
      : 'No archived goals. Archived goals keep their full history — nothing is ever deleted.';
  String get noCurrent => _ar
      ? 'لا توجد أهداف حالية بعد. يتتبع الهدف المدخرات بشكل مستقل ولا يغير صافي ثروتك.'
      : 'No current goals yet. A goal tracks savings on its own and never changes your net worth.';
  String get ledgerNote => _ar
      ? 'تقدم الهدف دفتر مستقل. هل نقلت مالاً في الواقع؟ حدّث الحساب أيضًا.'
      : 'Goal progress is a separate ledger. Moving money in real life? Update the account too.';
  // Goal types and statuses.
  String get active => _ar ? 'نشط' : 'ACTIVE';
  String get completed => _ar ? 'مكتمل' : 'COMPLETED';
  String get cancelled => _ar ? 'ملغى' : 'CANCELLED';
  String get overdue => _ar ? 'متأخر' : 'OVERDUE';
  String statusName(String status) => switch (status) {
    'completed' => _ar ? 'مكتمل' : 'completed',
    'cancelled' => _ar ? 'ملغى' : 'cancelled',
    _ => _ar ? 'نشط' : 'active',
  };
  String type(String type, {String? custom}) => switch (type) {
    'buy_home' => _ar ? 'شراء منزل' : 'Buy a home',
    'buy_car' => _ar ? 'شراء سيارة' : 'Buy a car',
    'travel' => _ar ? 'سفر' : 'Travel',
    'education' => _ar ? 'تعليم' : 'Education',
    _ =>
      (custom?.trim().isNotEmpty ?? false)
          ? custom!.trim()
          : (_ar ? 'أخرى' : 'Other'),
  };
  String daysOverdue(int days) =>
      _ar ? '${ltr('$days')} يومًا متأخرًا' : '$days days overdue';
  String targetDate(String date) =>
      _ar ? 'المستهدف ${ltr(date)}' : 'target $date';
  String get noTargetDate => _ar ? 'لا تاريخ مستهدف' : 'no target date';
  String funded(String percent) =>
      _ar ? 'مموّل ${ltr(percent)}' : '$percent funded';
  String overTarget(String percent, String amount) => _ar
      ? 'مموّل ${ltr(percent)} · ${ltr(amount)} فوق الهدف'
      : '$percent funded · $amount over target';
  String toGo(String percent, String amount) => _ar
      ? 'مموّل ${ltr(percent)} · ${ltr(amount)} متبقٍ'
      : '$percent funded · $amount to go';
  String ofTarget(String amount) => _ar ? 'من ${ltr(amount)}' : 'of $amount';

  // Shared form and action labels.
  String get addProgress => _ar ? 'إضافة تقدم' : 'Add progress';
  String get withdraw => _ar ? 'سحب' : 'Withdraw';
  String get close => _ar ? 'إغلاق' : 'Close';
  String get cancel => _ar ? 'إلغاء' : 'Cancel';
  String get continueLabel => _ar ? 'متابعة' : 'Continue';
  String get saveEntry => _ar ? 'حفظ القيد' : 'Save entry';
  String get amount => _ar ? 'المبلغ' : 'Amount';
  String get date => _ar ? 'التاريخ' : 'Date';
  String get note => _ar ? 'ملاحظة' : 'Note';
  String get noteHint => _ar ? 'الغرض من هذا القيد' : 'What this entry is for';
  String get optional => _ar ? 'اختياري' : 'optional';
  String get editGoal => _ar ? 'تعديل الهدف' : 'Edit goal';
  String get newGoal => _ar ? 'هدف جديد' : 'New goal';
  String get goalName => _ar ? 'اسم الهدف' : 'Goal name';
  String get goalType => _ar ? 'نوع الهدف' : 'Goal type';
  String get targetAmount => _ar ? 'المبلغ المستهدف' : 'Target amount';
  String get currency => _ar ? 'العملة' : 'Currency';
  String get targetDateLabel => _ar ? 'التاريخ المستهدف' : 'Target date';
  String get startingAmount => _ar ? 'المبلغ المبدئي' : 'Starting amount';
  String get createGoal => _ar ? 'إنشاء هدف' : 'Create goal';
  String get saveGoal => _ar ? 'حفظ الهدف' : 'Save goal';
  String get correctEntry => _ar ? 'تصحيح القيد' : 'Correct entry';
  String entryTitle(String mode) => switch (mode) {
    'progress' => addProgress,
    'withdrawal' => _ar ? 'سحب من الهدف' : 'Withdraw from goal',
    _ => correctEntry,
  };
  String get ledgerSubtitle => _ar
      ? 'تقدم الهدف دفتر مستقل — لا ينقل هذا أموال الحساب.'
      : 'Goal progress is a separate ledger — this never moves account money.';
  String get actionHint => _ar
      ? 'تظل إضافة التقدم والسحب في البطاقة؛ أما الإجراءات الأخرى فتظهر هنا. لا يُحذف شيء.'
      : 'Add progress and Withdraw stay on the card; everything else collapses here. Nothing is ever deleted.';
  String action(String action) => switch (action) {
    'withdraw' => entryTitle('withdrawal'),
    'correct' => _ar ? 'تصحيح آخر قيد' : 'Correct last entry',
    'reverse' => _ar ? 'عكس آخر قيد' : 'Reverse last entry',
    'complete' => _ar ? 'وضع علامة مكتمل' : 'Mark complete',
    'archive' => _ar ? 'أرشفة' : 'Archive',
    'unarchive' => _ar ? 'إلغاء الأرشفة' : 'Unarchive',
    'cancel' => _ar ? 'إلغاء الهدف' : 'Cancel goal',
    'reopen' => _ar ? 'إعادة فتح الهدف' : 'Reopen goal',
    _ => addProgress,
  };

  // Detail.
  String get unavailableGoal =>
      _ar ? 'لم يعد هذا الهدف متاحًا.' : 'This goal is no longer available.';
  String get fundedLabel => _ar ? 'المموّل' : 'FUNDED';
  String get targetLabel => _ar ? 'المستهدف' : 'TARGET';
  String remaining(String amount) =>
      _ar ? '${ltr(amount)} متبقٍ' : '$amount remaining';
  String surplus(String amount) =>
      _ar ? '${ltr(amount)} فوق الهدف' : '$amount over target';
  String inactiveGoal(String status, {required bool archived}) => archived
      ? (_ar
            ? 'هذا الهدف مؤرشف. ألغِ أرشفته من قائمة الإجراءات لإضافة تقدم مجددًا.'
            : 'This goal is archived. Unarchive it from the actions menu to add progress again.')
      : (_ar
            ? 'هذا الهدف ${statusName(status)}. أعد فتحه من قائمة الإجراءات لإضافة تقدم مجددًا.'
            : 'This goal is ${statusName(status)}. Reopen it from the actions menu to add progress again.');
  String get history => _ar ? 'السجل' : 'History';
  String get immutable => _ar ? 'غير قابل للتعديل' : 'IMMUTABLE';
  String get goalCreated => _ar ? 'تم إنشاء الهدف' : 'Goal created';
  String createdTarget(String date, String amount) =>
      _ar ? '${ltr(date)} · المستهدف ${ltr(amount)}' : '$date · target $amount';

  // History.
  String historyTitle(String kind) => switch (kind) {
    'correction' => _ar ? 'تم تسجيل التصحيح' : 'Correction recorded',
    'reversal' => _ar ? 'تم تسجيل العكس' : 'Reversal recorded',
    'correctedWithdrawal' => _ar ? 'سحب مصحح' : 'Corrected withdrawal',
    'correctedProgress' => _ar ? 'تقدم مصحح' : 'Corrected progress',
    'withdrawal' => _ar ? 'تم السحب' : 'Withdrawn',
    _ => _ar ? 'تمت إضافة تقدم' : 'Progress added',
  };
  String reverses(String kind, String date) =>
      _ar ? 'يعكس $kind بتاريخ ${ltr(date)}' : 'Reverses the $kind from $date';
  String get withdrawalNoun => _ar ? 'السحب' : 'withdrawal';
  String get progressNoun => _ar ? 'التقدم' : 'progress';
  String get correctsEarlier => _ar
      ? 'يصحح قيدًا سابقًا — تبقى القيمتان في السجل'
      : 'Corrects an earlier entry — both values stay in the history';
  String correctedTo(String amount, String date) => _ar
      ? 'صُحح إلى ${ltr(amount)} بتاريخ ${ltr(date)}'
      : 'Corrected to $amount on $date';
  String get reversedNotCounted =>
      _ar ? 'تم عكسه — لم يعد محتسبًا' : 'Reversed — no longer counted';
  String get reversalNote => _ar
      ? 'تم العكس من قائمة إجراءات الهدف'
      : 'Reversed from the goal actions sheet';

  // Forms.
  String get formSubtitle => _ar
      ? 'لا يغيّر هذا الهدف صافي ثروتك. إنه يتتبع النية لا الأموال المحجوزة.'
      : 'This goal won’t change your net worth. It tracks intention, not reserved money.';
  String get goalNameHint => _ar ? 'مثال: شراء سيارة' : 'e.g. Buy a car';
  String get customTypeName => _ar ? 'اسم النوع المخصص' : 'Custom type name';
  String get customTypeHint =>
      _ar ? 'ما الذي تدخر من أجله؟' : 'What are you saving for?';
  String get currencyLocked => _ar
      ? 'العملة مقفلة بعد تسجيل أول تقدم.'
      : 'Currency is locked after the first progress entry.';
  String get startingDate => _ar ? 'تاريخ البداية' : 'Starting date';
  String get startingAmountHint => _ar
      ? 'اختياري · ينشئ أول قيد تقدم'
      : 'Optional · creates the first progress entry';

  // Confirmations.
  String get correctionTitle => _ar ? 'تسجيل تصحيح؟' : 'Record a correction?';
  String get correctionBody => _ar
      ? 'يبقى القيد الأصلي في السجل وتُضاف القيمة المصححة بجانبه. ويُعاد حساب المبلغ المموّل.'
      : 'The original entry stays in the history; the corrected value is added alongside it. Funded amount is recalculated.';
  String get keepAsIs => _ar ? 'إبقاء كما هو' : 'Keep as is';
  String get reverseTitle => _ar ? 'عكس هذا القيد؟' : 'Reverse this entry?';
  String get reverseBody => _ar
      ? 'يبقى القيد في السجل، لكن يُلغى تأثيره في المبلغ المموّل. ولا يمكن تعديل ذلك لاحقًا.'
      : 'The entry stays in the history but its effect on the funded amount is undone. This cannot be edited afterwards.';
  String get cancelGoalTitle => _ar ? 'إلغاء هذا الهدف؟' : 'Cancel this goal?';
  String get cancelGoalBody => _ar
      ? 'ينتقل إلى تبويب المؤرشفة. يمكنك إعادة فتحه لاحقًا — لا يُحذف شيء.'
      : 'It moves to the archived tab. You can reopen it later — nothing is deleted.';
}
