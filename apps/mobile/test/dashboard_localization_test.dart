import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/dashboard/logic/key_insights.dart';
import 'package:tharwati_mobile/i18n/app_language.dart';
import 'package:tharwati_mobile/i18n/dashboard_copy.dart';
import 'package:tharwati_mobile/i18n/navigation_copy.dart';
import 'package:tharwati_mobile/i18n/settings_copy.dart';

void main() {
  test(
    'Dashboard, navigation, and Settings copy follows the selected language',
    () {
      final english = DashboardCopy.of(AppLanguage.en);
      final arabic = DashboardCopy.of(AppLanguage.ar);

      expect(NavigationCopy.of(AppLanguage.en).dashboard, 'Dashboard');
      expect(NavigationCopy.of(AppLanguage.ar).dashboard, 'لوحة المعلومات');
      expect(SettingsCopy.of(AppLanguage.ar).signOut, 'تسجيل الخروج');
      expect(english.keyInsights, 'Key insights');
      expect(arabic.keyInsights, 'أهم الرؤى');
      expect(
        arabic.insightTitle(InsightTone.ready),
        'قيم لوحة المعلومات متاحة',
      );
      expect(arabic.accountsSummary(2, 'EGP'), contains('\u20662\u2069'));
      expect(arabic.accountsSummary(2, 'EGP'), contains('\u2066EGP\u2069'));
      expect(arabic.activeGoals(3), contains('\u20663\u2069'));
      expect(arabic.due('2026-09-11'), contains('\u20662026-09-11\u2069'));
      expect(arabic.overTarget('250 EGP'), contains('\u2066250 EGP\u2069'));
      expect(arabic.date(DateTime(2026, 9, 11)), contains('\u206611\u2069'));
      expect(AppLanguage.en.direction, TextDirection.ltr);
      expect(AppLanguage.ar.direction, TextDirection.rtl);
    },
  );
}
