import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:tharwati_mobile/accounts/brokerage/brokerage_account_detail_page.dart';
import 'package:tharwati_mobile/accounts/brokerage/brokerage_activity.dart';
import 'package:tharwati_mobile/accounts/brokerage/brokerage_controller.dart';
import 'package:tharwati_mobile/accounts/brokerage/brokerage_models.dart';
import 'package:tharwati_mobile/accounts/brokerage/brokerage_repository.dart';
import 'package:tharwati_mobile/core/decimals.dart';
import 'package:tharwati_mobile/i18n/accounts_copy.dart';
import 'package:tharwati_mobile/i18n/app_language.dart';
import 'package:tharwati_mobile/portfolio/portfolio_models.dart';

Holding _holding(String id, {
  String quantity = '0.25',
  String cost = '8000',
  String accountCurrency = 'EGP',
  String assetCurrency = 'USD',
}) => Holding(
  id: 'holding-$id',
  accountId: 'brokerage',
  assetId: 'asset-$id',
  quantity: quantity,
  averageCost: null,
  totalCostBasis: cost,
  costCurrencyCode: accountCurrency,
  asset: Asset(
    id: 'asset-$id',
    name: id,
    symbol: id,
    exchange: 'NYSE',
    assetTypeCode: 'etf',
    currencyCode: assetCurrency,
    canonicalQuantityUnit: 'shares',
  ),
);

MarketPrice _price(String id, {String currency = 'USD'}) => MarketPrice(
  assetId: 'asset-$id',
  price: '767.18',
  currencyCode: currency,
  effectiveAt: '2026-09-27T12:00:00Z',
  provider: 'test',
  priceType: 'realtime',
  stale: false,
);

PortfolioFxRate _fx(String from, String to, String value, {
  bool stale = false,
}) => PortfolioFxRate(
  fromCurrencyCode: from,
  toCurrencyCode: to,
  rate: value,
  provider: 'test',
  effectiveAt: '2026-09-27T12:00:00Z',
  stale: stale,
);

class _Repository extends BrokerageRepository {
  _Repository(super.client);

  List<Holding> holdings = [_holding('SPY')];
  Map<String, MarketPrice> prices = {'asset-SPY': _price('SPY')};

  @override
  Future<List<Holding>> getHoldingsForAccount(String accountId) async =>
      List.of(holdings);

  @override
  Future<Map<String, MarketPrice>> getPrices(List<String> assetIds) async =>
      Map.of(prices);

  @override
  Future<String> getCashBalance(String accountId) async => '100';

  @override
  Future<List<ActivityItem>> getActivity(String accountId) async => const [];
}

void main() {
  late SupabaseClient client;
  late _Repository repo;
  setUp(() {
    client = SupabaseClient(
      'http://127.0.0.1:54321',
      'test-key',
      authOptions: const AuthClientOptions(autoRefreshToken: false),
    );
    repo = _Repository(client);
  });
  tearDown(() => client.dispose());

  test('same-currency quote completes with no FX request', () async {
    repo.holdings = [_holding('SPY', accountCurrency: 'USD', cost: '100')];
    var calls = 0;
    final controller = BrokerageController(
      accountId: 'brokerage',
      repository: repo,
      fxRateLoader: (_, _) async {
        calls++;
        return null;
      },
    );
    expect(await controller.load(), isTrue);
    expect(calls, 0);
    expect(D.compare(controller.valuation?.totalMarketValue, '191.795'), 0);
    expect(D.compare(controller.valuation?.currentValue, '291.795'), 0);
    controller.dispose();
  });

  test('USD to EGP current FX converts exact value and P/L', () async {
    final pairs = <String>[];
    final controller = BrokerageController(
      accountId: 'brokerage',
      repository: repo,
      fxRateLoader: (from, to) async {
        pairs.add('$from/$to');
        return _fx(from, to, '50.25');
      },
    );
    expect(await controller.load(), isTrue);
    final account = controller.valuation!;
    final holding = account.holdings.single;
    expect(pairs, ['USD/EGP']);
    expect(holding.marketPrice?.price, '767.18');
    expect(D.compare(holding.marketValue, '191.795'), 0);
    expect(D.compare(holding.accountMarketValue, '9637.69875'), 0);
    expect(D.compare(account.totalMarketValue, '9637.69875'), 0);
    expect(D.compare(account.currentValue, '9737.69875'), 0);
    expect(D.compare(holding.unrealizedGainLoss, '1637.69875'), 0);
    expect(D.compare(account.totalUnrealizedGainLoss, '1637.69875'), 0);
    expect(account.missingPriceCount, 0);
    expect(account.missingFxCount, 0);
    expect(holdingValuationFooter(holding, AccountsCopy.of(AppLanguage.en)),
        isNull);
    controller.dispose();
  });

  test('two USD holdings request USD/EGP once', () async {
    repo.holdings = [_holding('SPY'), _holding('VOO')];
    repo.prices['asset-VOO'] = _price('VOO');
    var calls = 0;
    final controller = BrokerageController(
      accountId: 'brokerage',
      repository: repo,
      fxRateLoader: (from, to) async {
        calls++;
        return _fx(from, to, '50');
      },
    );
    expect(await controller.load(), isTrue);
    expect(calls, 1);
    expect(D.compare(controller.valuation?.totalMarketValue, '19179.5'), 0);
    controller.dispose();
  });

  test('missing FX keeps USD evidence and reports FX, not missing price', () async {
    final controller = BrokerageController(
      accountId: 'brokerage',
      repository: repo,
      fxRateLoader: (_, _) async => null,
    );
    expect(await controller.load(), isTrue);
    final account = controller.valuation!;
    final holding = account.holdings.single;
    expect(holding.marketPrice?.price, '767.18');
    expect(D.compare(holding.marketValue, '191.795'), 0);
    expect(holding.accountMarketValue, isNull);
    expect(account.totalMarketValue, isNull);
    expect(account.currentValue, isNull);
    expect(account.missingFxCount, 1);
    expect(account.missingPriceCount, 0);
    final footer = holdingValuationFooter(
      holding,
      AccountsCopy.of(AppLanguage.en),
    );
    expect(footer, contains('FX unavailable'));
    expect(footer, isNot(contains('No current price')));
    expect(holdingValuationFooter(holding, AccountsCopy.of(AppLanguage.ar)),
        contains('سعر الصرف'));
    controller.dispose();
  });

  test('missing market price stays distinct and never falls back to zero', () async {
    repo.prices = {};
    var calls = 0;
    final controller = BrokerageController(
      accountId: 'brokerage',
      repository: repo,
      fxRateLoader: (_, _) async {
        calls++;
        return null;
      },
    );
    expect(await controller.load(), isTrue);
    expect(calls, 0);
    final account = controller.valuation!;
    expect(account.missingPriceCount, 1);
    expect(account.missingFxCount, 0);
    expect(account.currentValue, isNull);
    expect(account.holdings.single.marketValue, isNull);
    expect(holdingValuationFooter(account.holdings.single,
        AccountsCopy.of(AppLanguage.en)), 'No current price available');
    controller.dispose();
  });

  test('wrong currency pair and zero rate never mix currencies', () async {
    final controller = BrokerageController(
      accountId: 'brokerage',
      repository: repo,
      fxRateLoader: (_, _) async => _fx('USD', 'SAR', '50'),
    );
    expect(await controller.load(), isTrue);
    expect(controller.valuation?.holdings.single.accountMarketValue, isNull);
    expect(controller.valuation?.totalMarketValue, isNull);
    controller.dispose();

    final zeroRate = BrokerageController(
      accountId: 'brokerage',
      repository: repo,
      fxRateLoader: (from, to) async => _fx(from, to, '0'),
    );
    expect(await zeroRate.load(), isTrue);
    expect(zeroRate.valuation?.holdings.single.accountMarketValue, isNull);
    expect(zeroRate.valuation?.currentValue, isNull);
    zeroRate.dispose();
  });

  test('stale FX metadata is retained when its value is used', () async {
    final controller = BrokerageController(
      accountId: 'brokerage',
      repository: repo,
      fxRateLoader: (from, to) async => _fx(from, to, '50', stale: true),
    );
    expect(await controller.load(), isTrue);
    expect(controller.valuation?.hasStaleFx, isTrue);
    expect(controller.valuation?.holdings.single.currentFxRate?.stale, isTrue);
    expect(controller.valuation?.currentValue, isNotNull);
    controller.dispose();
  });

  test('late older FX result cannot replace newer refresh valuation', () async {
    final older = Completer<PortfolioFxRate?>();
    var calls = 0;
    final controller = BrokerageController(
      accountId: 'brokerage',
      repository: repo,
      fxRateLoader: (from, to) {
        calls++;
        return calls == 1
            ? older.future
            : Future.value(_fx(from, to, '50'));
      },
    );
    final oldLoad = controller.load();
    await Future<void>.delayed(Duration.zero);
    expect(controller.fxLoading, isTrue);
    repo.holdings = [_holding('SPY', quantity: '1', cost: '10000')];
    expect(await controller.load(), isTrue);
    expect(D.compare(controller.valuation?.currentValue, '38459'), 0);
    older.complete(_fx('USD', 'EGP', '30'));
    expect(await oldLoad, isFalse);
    expect(D.compare(controller.valuation?.currentValue, '38459'), 0);
    controller.dispose();
  });
}
