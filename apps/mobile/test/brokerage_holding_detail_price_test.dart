import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:tharwati_mobile/accounts/account_models.dart';
import 'package:tharwati_mobile/accounts/brokerage/brokerage_activity.dart';
import 'package:tharwati_mobile/accounts/brokerage/brokerage_controller.dart';
import 'package:tharwati_mobile/accounts/brokerage/brokerage_models.dart';
import 'package:tharwati_mobile/accounts/brokerage/brokerage_repository.dart';
import 'package:tharwati_mobile/accounts/brokerage/brokerage_valuation.dart';
import 'package:tharwati_mobile/accounts/brokerage/holding_detail_page.dart';
import 'package:tharwati_mobile/core/local_datetime.dart';
import 'package:tharwati_mobile/i18n/app_language.dart';
import 'package:tharwati_mobile/theme/tokens.dart';

class _HistoryRepository extends BrokerageRepository {
  _HistoryRepository()
    : super(
        SupabaseClient(
          'http://127.0.0.1:54321',
          'test-key',
          authOptions: const AuthClientOptions(autoRefreshToken: false),
        ),
      );

  @override
  Future<List<ActivityItem>> getActivity(String accountId) async => const [];
}

const _account = Account(
  id: 'usd-brokerage',
  type: AccountType.brokerage,
  name: 'Brokerage',
  currencyCode: 'USD',
  openingBalance: '100',
  isActive: true,
  notes: null,
  bankSubtype: null,
  creditCardLimit: null,
  dueDayOfMonth: null,
  investmentType: 'stock_etf',
  balanceGrams: null,
  propertyType: null,
  ownershipPercentage: null,
  businessType: null,
  industry: null,
  location: null,
  metalType: null,
  purity: null,
  purchaseDate: null,
  costPerUnit: null,
  closedReason: null,
  closedOn: null,
  createdAt: '',
  updatedAt: '',
);

const _holding = Holding(
  id: 'holding-voo',
  accountId: 'usd-brokerage',
  assetId: 'asset-voo',
  quantity: '2.0000000000',
  averageCost: '450',
  totalCostBasis: '900',
  costCurrencyCode: 'USD',
  asset: Asset(
    id: 'asset-voo',
    name: 'Vanguard S&P 500 ETF',
    symbol: 'VOO',
    exchange: 'NYSE',
    assetTypeCode: 'etf',
    currencyCode: 'USD',
    canonicalQuantityUnit: 'shares',
  ),
);

Future<BrokerageController> _pumpDetail(
  WidgetTester tester,
  MarketPrice? price, {
  Account account = _account,
  Holding holding = _holding,
}) async {
  final controller = BrokerageController(
    accountId: account.id,
    repository: _HistoryRepository(),
  );
  controller.valuation = valueBrokerageAccount(
    holdings: [holding],
    pricesByAssetId: price == null ? const {} : {holding.assetId: price},
    cashBalance: '100',
  );
  await tester.pumpWidget(
    AppLanguageScope(
      controller: AppLanguageController(),
      child: MaterialApp(
        theme: ThemeData(extensions: const [AppColors.light]),
        home: HoldingDetailPage(
          controller: controller,
          account: account,
          assetId: holding.assetId,
        ),
      ),
    ),
  );
  await tester.pump();
  return controller;
}

void main() {
  const providerWarning =
      'This price is stale — the provider hasn’t refreshed it recently.';

  MarketPrice fallback({
    String provider = 'twelve_data',
    String priceType = 'realtime',
    bool stale = true,
    String effectiveAt = '2026-09-01T10:00:00Z',
  }) => MarketPrice(
    assetId: _holding.assetId,
    price: '500',
    currencyCode: 'USD',
    provider: provider,
    priceType: priceType,
    stale: stale,
    effectiveAt: effectiveAt,
    fetchedAt: '2026-10-02T12:00:00Z',
  );

  testWidgets('stale provider retains provider warning and semantic color', (
    tester,
  ) async {
    final controller = await _pumpDetail(tester, fallback());
    expect(find.text('Current price'), findsOneWidget);
    expect(find.text(providerWarning), findsOneWidget);
    expect(find.text('Manual price'), findsNothing);
    expect(
      tester.widget<Text>(find.text(providerWarning)).style?.color,
      AppColors.light.warningFg,
    );
    expect(find.text('1,000.00 USD'), findsOneWidget);
    controller.dispose();
  });

  for (final source in ['provider', 'priceType']) {
    testWidgets('manual $source shows effective time without provider copy', (
      tester,
    ) async {
      final price = fallback(
        provider: source == 'provider' ? 'manual' : 'twelve_data',
        priceType: source == 'priceType' ? 'manual' : 'realtime',
        stale: source == 'provider',
      );
      final controller = await _pumpDetail(tester, price);
      final local = formatLocalDateTime(price.effectiveAt);
      final message = 'Manual price · Effective ${local.date} ${local.time}';
      expect(find.text('Manual price'), findsOneWidget);
      expect(find.text(message), findsOneWidget);
      expect(find.text(providerWarning), findsNothing);
      expect(find.text('Current price'), findsNothing);
      expect(find.textContaining('2026-10-02'), findsNothing);
      expect(
        tester.widget<Text>(find.text(message)).style?.color,
        AppColors.light.warningFg,
      );
      expect(find.text('500.00 USD'), findsOneWidget);
      expect(find.text('1,000.00 USD'), findsOneWidget);
      controller.dispose();
    });
  }

  testWidgets(
    'manual price without valid effective time invents no timestamp',
    (tester) async {
      final controller = await _pumpDetail(
        tester,
        fallback(provider: 'manual', effectiveAt: 'unknown'),
      );
      expect(find.text('Manual price'), findsNWidgets(2));
      expect(find.textContaining('Effective'), findsNothing);
      expect(find.text(providerWarning), findsNothing);
      expect(find.textContaining('unknown'), findsNothing);
      controller.dispose();
    },
  );

  testWidgets('previous close is identified even without a stale flag', (
    tester,
  ) async {
    final controller = await _pumpDetail(
      tester,
      fallback(priceType: 'previous_close', stale: false),
    );
    expect(find.text('Previous close'), findsOneWidget);
    expect(find.text('Previous close — not a live quote.'), findsOneWidget);
    expect(find.text('Current price'), findsNothing);
    expect(find.text(providerWarning), findsNothing);
    expect(find.text('1,000.00 USD'), findsOneWidget);
    controller.dispose();
  });

  testWidgets('valid USD VOO quote appears as price and exact quantity value', (
    tester,
  ) async {
    final price = MarketPrice.fromRow({
      'assetId': _holding.assetId,
      'available': true,
      'provider': 'twelve_data',
      'price': '500.1234567890',
      'currencyCode': 'USD',
      'effectiveAt': '2026-09-26T12:00:00Z',
      'priceType': 'realtime',
      'stale': false,
    });
    final controller = await _pumpDetail(tester, price);
    expect(find.text('VOO'), findsOneWidget);
    expect(find.text('500.12 USD'), findsOneWidget);
    expect(find.text('1,000.25 USD'), findsOneWidget);
    expect(find.text('Unavailable'), findsNothing);
    controller.dispose();
  });

  testWidgets('missing price shows unavailable rather than zero', (
    tester,
  ) async {
    final controller = await _pumpDetail(tester, null);
    expect(find.text('Unavailable'), findsNWidgets(2));
    expect(find.text('0.00 USD'), findsNothing);
    controller.dispose();
  });

  testWidgets('USD quote remains visible on EGP holding without EGP P&L', (
    tester,
  ) async {
    const account = Account(
      id: 'egp-brokerage',
      type: AccountType.brokerage,
      name: 'Brokerage',
      currencyCode: 'EGP',
      openingBalance: '100',
      isActive: true,
      notes: null,
      bankSubtype: null,
      creditCardLimit: null,
      dueDayOfMonth: null,
      investmentType: 'stock_etf',
      balanceGrams: null,
      propertyType: null,
      ownershipPercentage: null,
      businessType: null,
      industry: null,
      location: null,
      metalType: null,
      purity: null,
      purchaseDate: null,
      costPerUnit: null,
      closedReason: null,
      closedOn: null,
      createdAt: '',
      updatedAt: '',
    );
    final holding = Holding(
      id: 'holding-spy',
      accountId: account.id,
      assetId: 'asset-spy',
      quantity: '2.0000000000',
      averageCost: '1000',
      totalCostBasis: '2000',
      costCurrencyCode: 'EGP',
      asset: const Asset(
        id: 'asset-spy',
        name: 'SPDR S&P 500 ETF',
        symbol: 'SPY',
        exchange: 'NYSE',
        assetTypeCode: 'etf',
        currencyCode: 'USD',
        canonicalQuantityUnit: 'shares',
      ),
    );
    final quote = MarketPrice.fromRow({
      'assetId': holding.assetId,
      'available': true,
      'provider': 'twelve_data',
      'price': '500.1234567890',
      'currencyCode': 'USD',
      'effectiveAt': '2026-09-26T12:00:00Z',
      'priceType': 'realtime',
      'stale': false,
    });
    final controller = await _pumpDetail(
      tester,
      quote,
      account: account,
      holding: holding,
    );
    expect(find.text('SPY'), findsOneWidget);
    expect(find.text('500.12 USD'), findsOneWidget);
    expect(find.text('1,000.25 USD'), findsOneWidget);
    expect(find.textContaining('EGP ·'), findsNothing);
    expect(controller.valuation?.currentValue, isNull);
    expect(controller.valuation?.holdings.single.unrealizedGainLoss, isNull);
    controller.dispose();
  });
}
