import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/i18n/app_language.dart';
import 'package:tharwati_mobile/portfolio/portfolio_controller.dart';
import 'package:tharwati_mobile/portfolio/portfolio_page.dart';
import 'package:tharwati_mobile/portfolio/portfolio_valuation.dart';
import 'package:tharwati_mobile/theme/app_theme.dart';

import 'portfolio_test_support.dart';

void main() {
  testWidgets('renders launch sections from Phase 1 output', (tester) async {
    final controller = _readyController();
    await _pump(tester, controller: controller);

    expect(find.text('Portfolio Summary'), findsOneWidget);
    expect(find.text('All Brokerage Accounts'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Cash & Current Value'),
      250,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Cash & Current Value'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Securities Allocation'),
      250,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Securities Allocation'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Holdings by Brokerage account'),
      250,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Holdings by Brokerage account'), findsOneWidget);
    expect(find.text('25.00 USD'), findsOneWidget);
    controller.dispose();
  });

  testWidgets('unavailable aggregate is not rendered as zero', (tester) async {
    final controller = _readyController(pricesMissing: true);
    await _pump(tester, controller: controller);
    expect(find.text('Unavailable'), findsWidgets);
    expect(find.text('0.00 USD'), findsNothing);
    expect(find.text('Incomplete valuation'), findsOneWidget);
    controller.dispose();
  });

  testWidgets('account and holding rows invoke supported navigation', (
    tester,
  ) async {
    final controller = _readyController();
    String? accountId;
    String? assetId;
    await _pump(
      tester,
      controller: controller,
      page: PortfolioPage(
        controller: controller,
        onOpenAccount: (account) => accountId = account.id,
        onOpenHolding: (_, id) => assetId = id,
      ),
    );
    await tester.scrollUntilVisible(
      find.byKey(const Key('portfolio-account-broker')),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.byKey(const Key('portfolio-account-broker')));
    expect(accountId, 'broker');
    await tester.scrollUntilVisible(
      find.byKey(const Key('portfolio-holding-one')),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.byKey(const Key('portfolio-holding-one')));
    expect(assetId, 'asset-one');
    controller.dispose();
  });

  testWidgets(
    'Arabic is RTL while financial values remain LTR on compact width',
    (tester) async {
      tester.view.physicalSize = const Size(320, 700);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final controller = _readyController();
      await _pump(tester, controller: controller, language: AppLanguage.ar);
      expect(find.text('ملخص المحفظة'), findsOneWidget);
      final financial = tester.widget<Text>(find.text('20.00 USD').first);
      expect(financial.textDirection, TextDirection.ltr);
      expect(tester.takeException(), isNull);
      controller.dispose();
    },
  );

  testWidgets('cash-only Brokerage account remains in scope selector', (
    tester,
  ) async {
    final controller = _readyController(cashOnly: true);
    await _pump(tester, controller: controller);
    await tester.tap(find.byKey(const Key('portfolio-scope')));
    await tester.pumpAndSettle();
    expect(find.text('cash-only'), findsWidgets);
    controller.dispose();
  });

  testWidgets('formats quantities and preserves stored account casing', (
    tester,
  ) async {
    final controller = PortfolioController(
      loader: QueueLoader(),
      changes: ChangeNotifier(),
    );
    controller.data = valuePortfolio(
      source(
        accounts: [account('IBKR')],
        holdings: [holding('one', 'IBKR', quantity: '2.0000000000')],
        cash: {'IBKR': '5'},
        prices: {'asset-one': price('one')},
      ),
    );
    controller.status = PortfolioLoadStatus.ready;
    await _pump(tester, controller: controller);
    await tester.scrollUntilVisible(
      find.text('IBKR'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('IBKR'), findsOneWidget);
    expect(find.text('Quantity: 2 shares'), findsOneWidget);
    expect(find.textContaining('2.0000000000'), findsNothing);
    controller.dispose();
  });

  testWidgets('renders with the semantic dark theme', (tester) async {
    final controller = _readyController();
    await _pump(tester, controller: controller, dark: true);
    expect(find.text('Portfolio Summary'), findsOneWidget);
    expect(tester.takeException(), isNull);
    controller.dispose();
  });
}

PortfolioController _readyController({
  bool pricesMissing = false,
  bool cashOnly = false,
}) {
  final controller = PortfolioController(
    loader: QueueLoader(),
    changes: ChangeNotifier(),
  );
  final accounts = cashOnly
      ? [account('broker'), account('cash-only')]
      : [account('broker')];
  controller.data = valuePortfolio(
    source(
      accounts: accounts,
      holdings: [holding('one', 'broker')],
      cash: {'broker': '5', if (cashOnly) 'cash-only': '17'},
      prices: pricesMissing ? const {} : {'asset-one': price('one')},
    ),
  );
  controller.status = PortfolioLoadStatus.ready;
  return controller;
}

Future<void> _pump(
  WidgetTester tester, {
  required PortfolioController controller,
  AppLanguage language = AppLanguage.en,
  PortfolioPage? page,
  bool dark = false,
}) async {
  final languageController = AppLanguageController(
    store: _MemoryLanguageStore(language),
  );
  await languageController.load();
  await tester.pumpWidget(
    MaterialApp(
      theme: dark ? AppTheme.dark() : AppTheme.light(),
      home: AppLanguageScope(
        controller: languageController,
        child: page ?? PortfolioPage(controller: controller),
      ),
    ),
  );
  await tester.pump();
}

class _MemoryLanguageStore implements LanguageStore {
  const _MemoryLanguageStore(this.language);
  final AppLanguage language;
  @override
  Future<String?> readLanguage() async => language.code;
  @override
  Future<void> writeLanguage(String code) async {}
}
