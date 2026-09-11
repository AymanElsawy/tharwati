import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/i18n/app_language.dart';
import 'package:tharwati_mobile/i18n/goals_copy.dart';

void main() {
  test('Goals copy and directionality follow the app language', () {
    final english = GoalsCopy.of(AppLanguage.en);
    final arabic = GoalsCopy.of(AppLanguage.ar);

    expect(english.addProgress, 'Add progress');
    expect(english.unavailableGoal, 'This goal is no longer available.');
    expect(english.history, 'History');
    expect(english.newGoal, 'New goal');
    expect(english.action('correct'), 'Correct last entry');
    expect(english.correctionTitle, 'Record a correction?');
    expect(english.historyTitle('withdrawal'), 'Withdrawn');
    expect(english.reversalNote, 'Reversed from the goal actions sheet');

    expect(arabic.addProgress, 'إضافة تقدم');
    expect(arabic.type('buy_home'), 'شراء منزل');
    expect(arabic.current(3), 'الحالية · \u20663\u2069');
    expect(arabic.unavailableGoal, 'لم يعد هذا الهدف متاحًا.');
    expect(arabic.history, 'السجل');
    expect(arabic.goalCreated, 'تم إنشاء الهدف');
    expect(arabic.newGoal, 'هدف جديد');
    expect(arabic.formSubtitle, contains('صافي ثروتك'));
    expect(arabic.action('correct'), 'تصحيح آخر قيد');
    expect(arabic.correctionTitle, 'تسجيل تصحيح؟');
    expect(arabic.reverseTitle, 'عكس هذا القيد؟');
    expect(arabic.historyTitle('withdrawal'), 'تم السحب');
    expect(arabic.reversalNote, 'تم العكس من قائمة إجراءات الهدف');
    expect(arabic.formatDate('2026-09-11'), '11 سبتمبر 2026');
    expect(arabic.funded('25%'), contains('\u206625%\u2069'));
    expect(
      arabic.overTarget('125%', '250 EGP'),
      contains('\u2066250 EGP\u2069'),
    );
    expect(AppLanguage.ar.direction, TextDirection.rtl);
    expect(AppLanguage.en.direction, TextDirection.ltr);
  });
}
