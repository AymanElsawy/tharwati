import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/analysis/data/wealth_allocation_targets_repository.dart';
import 'package:tharwati_mobile/analysis/data/wealth_analysis_service.dart';
import 'package:tharwati_mobile/analysis/domain/wealth_analysis.dart';
import 'package:tharwati_mobile/analysis/domain/wealth_target_allocation.dart';
import 'package:tharwati_mobile/analysis/wealth_target_editor_page.dart';
import 'package:tharwati_mobile/analysis/wealth_analysis_page.dart';
import 'package:tharwati_mobile/analysis/state/wealth_analysis_controller.dart';
import 'package:tharwati_mobile/core/money_format.dart';
import 'package:tharwati_mobile/dashboard/logic/dashboard_aggregate.dart';
import 'package:tharwati_mobile/i18n/app_language.dart';
import 'package:tharwati_mobile/i18n/wealth_analysis_copy.dart';
import 'package:tharwati_mobile/theme/app_theme.dart';
import 'package:tharwati_mobile/widgets/primary_button.dart';

DashboardAggregate aggregate({
  AggregateStatus status = AggregateStatus.complete,
  String? totalAssets = '100',
  Map<AssetGroup, String?>? breakdown,
}) => DashboardAggregate(
  baseCurrencyCode: 'EGP',
  status: status,
  totalAssets: status == AggregateStatus.complete ? totalAssets : null,
  totalLiabilities: status == AggregateStatus.complete ? '0' : null,
  netWorth: status == AggregateStatus.complete ? totalAssets : null,
  assetBreakdown:
      breakdown ??
      {
        AssetGroup.cashAndBank: status == AggregateStatus.complete
            ? '50'
            : null,
        AssetGroup.brokerage: status == AggregateStatus.complete ? '50' : null,
        AssetGroup.goldAndSilver: status == AggregateStatus.complete
            ? '0'
            : null,
        AssetGroup.realEstate: status == AggregateStatus.complete ? '0' : null,
        AssetGroup.business: status == AggregateStatus.complete ? '0' : null,
        AssetGroup.certificates: status == AggregateStatus.complete
            ? '0'
            : null,
        AssetGroup.other: status == AggregateStatus.complete ? '0' : null,
      },
  accountCount: 2,
  unavailablePairs: status == AggregateStatus.complete
      ? const []
      : const ['USD/EGP'],
  unavailableSources: status == AggregateStatus.complete
      ? const []
      : const ['Brokerage'],
);

List<WealthTarget> targets(Map<AssetGroup, String> values) => wealthAssetGroups
    .map(
      (group) =>
          WealthTarget(assetClass: group, percentage: values[group] ?? '0'),
    )
    .toList(growable: false);

WealthTargetComparison compare(
  DashboardAggregate value,
  List<WealthTarget> plan, {
  String? tolerance = '5',
}) => calculateWealthTargetComparison(
  aggregate: value,
  evidence: buildWealthAnalysisEvidence(value),
  targets: plan,
  tolerancePercentage: tolerance,
);

void main() {
  group('Wealth Target Allocation domain parity', () {
    test('requires an exact 100 percent target total', () {
      final valid = summarizeWealthTargetInputs({
        AssetGroup.cashAndBank: '20',
        AssetGroup.brokerage: '30',
        AssetGroup.goldAndSilver: '10',
        AssetGroup.realEstate: '20',
        AssetGroup.business: '10',
        AssetGroup.other: '10',
      });
      final inexact = summarizeWealthTargetInputs({
        AssetGroup.cashAndBank: '19.999999',
        AssetGroup.brokerage: '30',
        AssetGroup.goldAndSilver: '10',
        AssetGroup.realEstate: '20',
        AssetGroup.business: '10',
        AssetGroup.other: '10',
      });

      expect(valid.total, '100');
      expect(valid.isValid, isTrue);
      expect(inexact.total, '99.999999');
      expect(inexact.isValid, isFalse);
    });

    test('blank tolerance normalizes to zero but invalid text does not', () {
      expect(summarizeWealthToleranceInput('').tolerancePercentage, '0');
      expect(summarizeWealthToleranceInput('').isValid, isTrue);
      expect(summarizeWealthToleranceInput('0').isValid, isTrue);
      expect(summarizeWealthToleranceInput('invalid').isValid, isFalse);
      expect(
        summarizeWealthToleranceInput('invalid').tolerancePercentage,
        isNull,
      );
    });

    test('zero-target classes are omitted from rows and denominator', () {
      final value = aggregate(
        totalAssets: '1000',
        breakdown: const {
          AssetGroup.cashAndBank: '900',
          AssetGroup.brokerage: '50',
          AssetGroup.goldAndSilver: '0',
          AssetGroup.realEstate: '50',
          AssetGroup.business: '0',
          AssetGroup.certificates: '0',
          AssetGroup.other: '0',
        },
      );
      final plan = targets({
        AssetGroup.brokerage: '50',
        AssetGroup.realEstate: '50',
      });
      final result = compare(value, plan);

      expect(result.status, WealthTargetComparisonStatus.available);
      expect(result.comparisonBase, '100');
      expect(result.rows.map((row) => row.assetClass.group), [
        AssetGroup.brokerage,
        AssetGroup.realEstate,
      ]);
      expect(
        getExcludedValuedTargetClasses(
          buildWealthAnalysisEvidence(value),
          plan,
        ).map((item) => item.group),
        [AssetGroup.cashAndBank],
      );
    });

    test('calculates exact-target percentage and monetary gaps', () {
      final result = compare(
        aggregate(),
        targets({AssetGroup.cashAndBank: '20', AssetGroup.brokerage: '80'}),
      );

      expect(result.rows.first.currentPercentage, '50');
      expect(result.rows.first.gapPercentage, '30');
      expect(result.rows.first.monetaryGap, '30');
      expect(result.rows.last.gapPercentage, '-30');
      expect(result.rows.last.monetaryGap, '-30');
    });

    test('zero tolerance classifies exact, above, and below values', () {
      final exact = compare(
        aggregate(),
        targets({AssetGroup.cashAndBank: '50', AssetGroup.brokerage: '50'}),
        tolerance: null,
      );
      final drifted = compare(
        aggregate(),
        targets({AssetGroup.cashAndBank: '40', AssetGroup.brokerage: '60'}),
        tolerance: '0',
      );

      expect(
        exact.rows.map((row) => row.status),
        everyElement(WealthTargetDriftStatus.within),
      );
      expect(drifted.rows.map((row) => row.status), [
        WealthTargetDriftStatus.above,
        WealthTargetDriftStatus.below,
      ]);
    });

    test('tolerance boundaries are inclusive', () {
      final value = aggregate(
        breakdown: const {
          AssetGroup.cashAndBank: '25',
          AssetGroup.brokerage: '75',
          AssetGroup.goldAndSilver: '0',
          AssetGroup.realEstate: '0',
          AssetGroup.business: '0',
          AssetGroup.certificates: '0',
          AssetGroup.other: '0',
        },
      );
      final result = compare(
        value,
        targets({AssetGroup.cashAndBank: '30', AssetGroup.brokerage: '70'}),
        tolerance: '5',
      );

      expect(
        result.rows.map((row) => row.status),
        everyElement(WealthTargetDriftStatus.within),
      );
    });

    test('incomplete valuation never becomes zero', () {
      final value = aggregate(status: AggregateStatus.incomplete);
      final result = compare(
        value,
        targets({AssetGroup.cashAndBank: '50', AssetGroup.brokerage: '50'}),
      );

      expect(result.status, WealthTargetComparisonStatus.unavailable);
      expect(result.reason, WealthTargetUnavailableReason.valuationIncomplete);
      expect(value.totalAssets, isNull);
    });

    test('selects only the largest out-of-range deviation', () {
      final result = compare(
        aggregate(),
        targets({AssetGroup.cashAndBank: '20', AssetGroup.brokerage: '80'}),
      );

      expect(result.largestDeviation?.assetClass.group, AssetGroup.cashAndBank);
      expect(result.largestDeviation?.gapPercentage, '30');
    });
  });

  group('Wealth target Supabase boundary', () {
    test('normalizes PostgREST numbers and strings to decimal strings', () {
      final plan = mapStoredWealthTargetPlan(
        [
          {'asset_class': 'cash_and_bank', 'target_percentage': 20},
          {'asset_class': 'brokerage', 'target_percentage': '30.500'},
        ],
        {'tolerance_percentage': 5.25},
      );

      expect(plan.targets.first.percentage, '20');
      expect(plan.targets.last.percentage, '30.5');
      expect(plan.tolerancePercentage, '5.25');
    });

    test('missing persisted tolerance resolves to zero', () {
      final plan = mapStoredWealthTargetPlan(const [], null);
      expect(plan.tolerancePercentage, '0');
    });

    test(
      'a persisted 25 percent plan and tolerance remain comparison-ready',
      () {
        final plan = mapStoredWealthTargetPlan(
          const [
            {'asset_class': 'cash_and_bank', 'target_percentage': 25},
            {'asset_class': 'brokerage', 'target_percentage': 25},
            {'asset_class': 'gold_and_silver', 'target_percentage': 25},
            {'asset_class': 'real_estate', 'target_percentage': 25},
            {'asset_class': 'business', 'target_percentage': 0},
            {'asset_class': 'other', 'target_percentage': 0},
          ],
          const {'tolerance_percentage': 2},
        );
        final result = compare(
          aggregate(
            breakdown: const {
              AssetGroup.cashAndBank: '25',
              AssetGroup.brokerage: '25',
              AssetGroup.goldAndSilver: '25',
              AssetGroup.realEstate: '25',
              AssetGroup.business: '0',
              AssetGroup.certificates: '0',
              AssetGroup.other: '0',
            },
          ),
          plan.targets,
          tolerance: plan.tolerancePercentage,
        );

        expect(plan.tolerancePercentage, '2');
        expect(result.rows, hasLength(4));
        expect(
          result.rows.map((row) => row.status),
          everyElement(WealthTargetDriftStatus.within),
        );
      },
    );
  });

  test('Wealth Analysis copy supports English and Arabic', () {
    expect(WealthAnalysisCopy.of(AppLanguage.en).pageTitle, 'Wealth Analysis');
    expect(WealthAnalysisCopy.of(AppLanguage.ar).pageTitle, 'تحليل الثروة');
    expect(
      WealthAnalysisCopy.of(
        AppLanguage.ar,
      ).largestExposureBody('الوساطة', '50%'),
      contains('\u206650%\u2069'),
    );
    expect(
      WealthAnalysisCopy.of(
        AppLanguage.en,
      ).healthSynthesis(incomplete: true, stale: false),
      contains('limited view'),
    );
    expect(
      WealthAnalysisCopy.of(AppLanguage.ar).toleranceSummary('5%'),
      contains('\u2066±5%\u2069'),
    );
  });

  test('uses the stable Wealth Analysis asset-class product order', () {
    expect(wealthAssetGroups, [
      AssetGroup.cashAndBank,
      AssetGroup.brokerage,
      AssetGroup.goldAndSilver,
      AssetGroup.realEstate,
      AssetGroup.business,
      AssetGroup.other,
    ]);
  });

  test('analytical monetary gaps round only at display time', () {
    expect(MoneyFormat.roundedMoney('753751.7', 'EGP'), '753,752 EGP');
    expect(MoneyFormat.signedRoundedMoney('-92087.3', 'EGP'), '-92,087 EGP');
  });

  test(
    'a stale failed reload cannot replace newer successful Analysis data',
    () async {
      final service = _QueuedWealthAnalysisSource();
      final controller = WealthAnalysisController(service: service);
      final newerLoad = controller.load(silent: true);

      service.loads[1].complete(_analysisData(total: '250'));
      await newerLoad;
      expect(controller.status, WealthAnalysisStatus.ready);
      expect(controller.data?.aggregate.totalAssets, '250');

      service.loads[0].completeError(StateError('stale request failed'));
      await Future<void>.delayed(Duration.zero);

      expect(controller.status, WealthAnalysisStatus.ready);
      expect(controller.data?.aggregate.totalAssets, '250');
      expect(controller.loadError, isNull);
      controller.dispose();
    },
  );

  test(
    'a failed background refresh keeps data and exposes the failure',
    () async {
      final service = _QueuedWealthAnalysisSource();
      final controller = WealthAnalysisController(service: service);
      service.loads.single.complete(_analysisData(total: '250'));
      await Future<void>.delayed(Duration.zero);

      final refresh = controller.load(silent: true);
      service.loads.last.completeError(StateError('refresh failed'));
      await refresh;

      expect(controller.status, WealthAnalysisStatus.ready);
      expect(controller.data?.aggregate.totalAssets, '250');
      expect(controller.loadError, isA<StateError>());
      controller.dispose();
    },
  );

  test('a load completion after disposal is ignored safely', () async {
    final service = _QueuedWealthAnalysisSource();
    final controller = WealthAnalysisController(service: service);
    controller.dispose();

    service.loads.single.complete(_analysisData());
    await Future<void>.delayed(Duration.zero);
  });

  test('returning to the Analysis tab starts one controlled reload', () async {
    final service = _QueuedWealthAnalysisSource();
    final controller = WealthAnalysisController(service: service);
    service.loads.single.complete(_analysisData());
    await Future<void>.delayed(Duration.zero);
    expect(service.loads, hasLength(1));

    controller.handleTabActivity(wasActive: true, isActive: true);
    expect(service.loads, hasLength(1));
    controller.handleTabActivity(wasActive: true, isActive: false);
    expect(service.loads, hasLength(1));
    controller.handleTabActivity(wasActive: false, isActive: true);
    expect(service.loads, hasLength(2));
    service.loads.last.complete(_analysisData(total: '300'));
    await Future<void>.delayed(Duration.zero);
    expect(controller.data?.aggregate.totalAssets, '300');
    controller.dispose();
  });

  testWidgets('target editor starts all target fields and tolerance at zero', (
    tester,
  ) async {
    final language = AppLanguageController(store: _MemoryLanguageStore());
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: AppLanguageScope(
          controller: language,
          child: WealthTargetEditorPage(
            plan: const WealthTargetPlan(targets: [], tolerancePercentage: '0'),
            onSave: (_) async => true,
          ),
        ),
      ),
    );

    final fields = tester
        .widgetList<TextField>(find.byType(TextField))
        .toList();
    expect(fields, hasLength(7));
    expect(
      fields.take(6).every((field) => field.controller?.text == '0'),
      isTrue,
    );
    expect(fields.last.controller?.text, '0');
    expect(find.text('0% / 100%'), findsOneWidget);
    expect(find.byType(PrimaryButton), findsOneWidget);
    await tester.drag(find.byType(ListView), const Offset(0, -240));
    await tester.pump();
    expect(
      find.text('0% means only an exact match to your target is within range.'),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'target header action has finite Row constraints on narrow screens',
    (tester) async {
      final language = AppLanguageController(store: _MemoryLanguageStore());
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: AppLanguageScope(
            controller: language,
            child: Scaffold(
              body: SizedBox(
                width: 280,
                child: Row(
                  children: [
                    const Expanded(child: SizedBox()),
                    CompactButton(
                      label: 'Edit target',
                      icon: Icons.edit_outlined,
                      onPressed: () {},
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );

      final size = tester.getSize(find.byType(CompactButton));
      expect(size.width.isFinite, isTrue);
      expect(size.width, greaterThan(0));
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('Brokerage allocation row opens Portfolio Analysis', (
    tester,
  ) async {
    final source = _QueuedWealthAnalysisSource();
    final controller = WealthAnalysisController(service: source);
    controller.data = _analysisData(brokerage: '100');
    controller.status = WealthAnalysisStatus.ready;
    var opened = false;
    final language = AppLanguageController(store: _MemoryLanguageStore());
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: AppLanguageScope(
          controller: language,
          child: WealthAnalysisPage(
            controller: controller,
            onOpenPortfolioAnalysis: () => opened = true,
          ),
        ),
      ),
    );
    await tester.ensureVisible(
      find.byKey(const Key('wealth-brokerage-portfolio-link')),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('wealth-brokerage-portfolio-link')));
    expect(opened, isTrue);
    controller.dispose();
  });
}

class _MemoryLanguageStore implements LanguageStore {
  @override
  Future<String?> readLanguage() async => null;

  @override
  Future<void> writeLanguage(String code) async {}
}

WealthAnalysisData _analysisData({
  String total = '100',
  String brokerage = '0',
}) {
  final value = aggregate(
    totalAssets: total,
    breakdown: {
      AssetGroup.cashAndBank: brokerage == '0' ? total : '0',
      AssetGroup.brokerage: brokerage,
      AssetGroup.goldAndSilver: '0',
      AssetGroup.realEstate: '0',
      AssetGroup.business: '0',
      AssetGroup.certificates: '0',
      AssetGroup.other: '0',
    },
  );
  return WealthAnalysisData(
    aggregate: value,
    evidence: buildWealthAnalysisEvidence(value),
    targetPlan: const WealthTargetPlan(targets: [], tolerancePercentage: '0'),
  );
}

class _QueuedWealthAnalysisSource implements WealthAnalysisDataSource {
  final loads = <Completer<WealthAnalysisData>>[];

  @override
  Future<WealthAnalysisData> load() {
    final completer = Completer<WealthAnalysisData>();
    loads.add(completer);
    return completer.future;
  }

  @override
  Future<void> saveTargetPlan(WealthTargetPlan plan) async {}
}
