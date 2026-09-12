import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/dashboard/data/dashboard_snapshot.dart';
import 'package:tharwati_mobile/dashboard/logic/dashboard_aggregate.dart';
import 'package:tharwati_mobile/dashboard/logic/key_insights.dart';
import 'package:tharwati_mobile/dashboard/widgets/assets_breakdown_card.dart';
import 'package:tharwati_mobile/dashboard/widgets/portfolio_allocation_card.dart';
import 'package:tharwati_mobile/i18n/app_language.dart';
import 'package:tharwati_mobile/i18n/dashboard_copy.dart';
import 'package:tharwati_mobile/i18n/navigation_copy.dart';
import 'package:tharwati_mobile/i18n/settings_copy.dart';
import 'package:tharwati_mobile/theme/app_theme.dart';

void main() {
  test(
    'Dashboard, navigation, and Settings copy follows the selected language',
    () {
      final english = DashboardCopy.of(AppLanguage.en);
      final arabic = DashboardCopy.of(AppLanguage.ar);

      expect(NavigationCopy.of(AppLanguage.en).dashboard, 'Dashboard');
      expect(NavigationCopy.of(AppLanguage.ar).dashboard, 'لوحة المعلومات');
      expect(NavigationCopy.of(AppLanguage.en).analysis, 'Analysis');
      expect(NavigationCopy.of(AppLanguage.ar).analysis, 'التحليل');
      expect(
        NavigationCopy.of(AppLanguage.en).wealthAnalysis,
        'Wealth Analysis',
      );
      expect(NavigationCopy.of(AppLanguage.ar).wealthAnalysis, 'تحليل الثروة');
      expect(
        NavigationCopy.of(AppLanguage.en).portfolioAnalysis,
        'Portfolio Analysis',
      );
      expect(
        NavigationCopy.of(AppLanguage.ar).portfolioAnalysis,
        'تحليل المحفظة',
      );
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

  testWidgets(
    'Dashboard analysis previews expose distinct navigation actions',
    (tester) async {
      var openedAnalysis = false;
      var openedPortfolio = false;
      final language = AppLanguageController(store: _MemoryLanguageStore());

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: AppLanguageScope(
            controller: language,
            child: Scaffold(
              body: Column(
                children: [
                  AssetsBreakdownCard(
                    aggregate: const DashboardAggregate(
                      baseCurrencyCode: 'EGP',
                      status: AggregateStatus.complete,
                      totalAssets: '0',
                      totalLiabilities: '0',
                      netWorth: '0',
                      assetBreakdown: {},
                      accountCount: 0,
                      unavailablePairs: [],
                      unavailableSources: [],
                    ),
                    onTap: () => openedAnalysis = true,
                  ),
                  PortfolioAllocationCard(
                    items: const [],
                    status: PortfolioAllocationStatus.complete,
                    currency: 'EGP',
                    onTap: () => openedPortfolio = true,
                  ),
                ],
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('No breakdown yet'));
      await tester.tap(find.text('Portfolio allocation'));

      expect(openedAnalysis, isTrue);
      expect(openedPortfolio, isTrue);
    },
  );
}

class _MemoryLanguageStore implements LanguageStore {
  @override
  Future<String?> readLanguage() async => null;

  @override
  Future<void> writeLanguage(String code) async {}
}
