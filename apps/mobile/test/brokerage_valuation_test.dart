import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/accounts/brokerage/brokerage_models.dart';
import 'package:tharwati_mobile/accounts/brokerage/brokerage_valuation.dart';
import 'package:tharwati_mobile/core/decimals.dart';

Asset asset({String id = 'as1', String currency = 'USD'}) => Asset(
  id: id,
  name: 'Acme Corp',
  symbol: 'ACME',
  exchange: 'NASDAQ',
  assetTypeCode: 'stock',
  currencyCode: currency,
  canonicalQuantityUnit: null,
);

Holding holding({
  String id = 'h1',
  String assetId = 'as1',
  String quantity = '10',
  String costBasis = '1000',
  String costCurrency = 'USD',
}) => Holding(
  id: id,
  accountId: 'acc1',
  assetId: assetId,
  quantity: quantity,
  averageCost: D.divide(costBasis, quantity, scale: 10),
  totalCostBasis: costBasis,
  costCurrencyCode: costCurrency,
  asset: asset(id: assetId, currency: costCurrency),
);

MarketPrice price({
  String assetId = 'as1',
  String value = '120',
  String currency = 'USD',
}) => MarketPrice(
  assetId: assetId,
  price: value,
  currencyCode: currency,
  effectiveAt: '2026-09-09T12:00:00Z',
  provider: 'twelve_data',
  priceType: 'delayed',
  stale: false,
);

void main() {
  group('USD VOO market-price path', () {
    final voo = Holding(
      id: 'holding-voo',
      accountId: 'usd-brokerage',
      assetId: 'asset-voo',
      quantity: '1.0000000000',
      averageCost: '450',
      totalCostBasis: '450',
      costCurrencyCode: 'USD',
      asset: const Asset(
        id: 'asset-voo',
        name: 'Vanguard S&P 500 ETF',
        symbol: 'VOO',
        exchange: 'NYSE',
        assetTypeCode: 'etf',
        currencyCode: 'USD',
        canonicalQuantityUnit: 'shares',
      ),
    );

    Map<String, dynamic> quote({
      Object? value = '500.1234567890',
      bool available = true,
      bool stale = false,
    }) => {
      'assetId': 'asset-voo',
      'available': available,
      'provider': 'twelve_data',
      'price': value,
      'currencyCode': 'USD',
      'effectiveAt': '2026-09-26T12:00:00Z',
      'priceType': stale ? 'stale' : 'realtime',
      'stale': stale,
    };

    test('valid same-currency quote keeps price and exact market value', () {
      final parsed = MarketPrice.fromRow(quote());
      expect(parsed?.assetId, voo.assetId);
      expect(parsed?.price, '500.1234567890');
      final valued = valueBrokerageAccount(
        holdings: [voo],
        pricesByAssetId: {voo.assetId: parsed!},
        cashBalance: '100',
      );
      expect(valued.holdings.single.marketPrice?.price, parsed.price);
      expect(
        D.compare(valued.holdings.single.marketValue, '500.1234567890'),
        0,
      );
      expect(D.compare(valued.currentValue, '600.1234567890'), 0);
    });

    test('missing and invalid quotes stay unavailable rather than zero', () {
      expect(MarketPrice.fromRow(quote(value: '0')), isNull);
      expect(MarketPrice.fromRow(quote(value: 'invalid')), isNull);
      expect(MarketPrice.fromRow(quote(available: false, value: null)), isNull);
      final valued = valueBrokerageAccount(
        holdings: [voo],
        pricesByAssetId: const {},
        cashBalance: '100',
      );
      expect(valued.holdings.single.marketPrice, isNull);
      expect(valued.holdings.single.marketValue, isNull);
      expect(valued.totalMarketValue, isNull);
      expect(valued.currentValue, isNull);
    });

    test('a valid stale snapshot retains its stale marker', () {
      final parsed = MarketPrice.fromRow(quote(stale: true));
      expect(parsed?.stale, isTrue);
      expect(valueHolding(voo, parsed).marketPrice?.stale, isTrue);
    });

    test(
      'USD quote retains native value while SAR account totals need FX',
      () {
        final sarHolding = Holding(
          id: voo.id,
          accountId: 'sar-brokerage',
          assetId: voo.assetId,
          quantity: voo.quantity,
          averageCost: voo.averageCost,
          totalCostBasis: voo.totalCostBasis,
          costCurrencyCode: 'SAR',
          asset: voo.asset,
        );
        final valued = valueHolding(sarHolding, MarketPrice.fromRow(quote()));
        expect(valued.marketPrice?.price, '500.1234567890');
        expect(D.compare(valued.marketValue, '500.1234567890'), 0);
        expect(valued.accountMarketValue, isNull);
        expect(valued.needsFx, isTrue);
        expect(valued.unrealizedGainLoss, isNull);
        final account = valueBrokerageAccount(
          holdings: [sarHolding],
          pricesByAssetId: {voo.assetId: MarketPrice.fromRow(quote())!},
          cashBalance: '100',
        );
        expect(account.totalMarketValue, isNull);
        expect(account.currentValue, isNull);
        expect(account.totalUnrealizedGainLoss, isNull);
        expect(account.missingFxCount, 1);
        expect(account.missingPriceCount, 0);
      },
    );
  });

  group('valueHolding', () {
    test('market value, gain and return percent', () {
      final v = valueHolding(holding(), price());
      expect(D.compare(v.marketValue!, '1200'), 0);
      expect(D.compare(v.unrealizedGainLoss!, '200'), 0);
      expect(D.compare(v.unrealizedReturnPercent!, '20'), 0);
    });

    test('a loss is negative, not absolute', () {
      final v = valueHolding(holding(), price(value: '80'));
      expect(D.compare(v.unrealizedGainLoss!, '-200'), 0);
      expect(D.compare(v.unrealizedReturnPercent!, '-20'), 0);
    });

    test('no price is unavailable, never zero', () {
      final v = valueHolding(holding(), null);
      expect(v.marketValue, isNull);
      expect(v.unrealizedGainLoss, isNull);
      expect(v.isPriced, isFalse);
      final account = valueBrokerageAccount(
        holdings: [holding()],
        pricesByAssetId: const {},
        cashBalance: '10',
      );
      expect(account.missingPriceCount, 1);
      expect(account.missingFxCount, 0);
    });

    // The web raises `currency_mismatch` rather than valuing across currencies;
    // converting would need an FX rate the account page never loads.
    test('a price in another currency is not applied', () {
      final v = valueHolding(holding(), price(currency: 'EUR'));
      expect(v.marketValue, isNull);
      expect(v.marketPrice, isNull);
    });

    test(
      'a zero cost basis yields no return percent, not a divide by zero',
      () {
        final v = valueHolding(holding(costBasis: '0'), price());
        expect(D.compare(v.marketValue!, '1200'), 0);
        expect(D.compare(v.unrealizedGainLoss!, '1200'), 0);
        expect(v.unrealizedReturnPercent, isNull);
      },
    );
  });

  group('valueBrokerageAccount', () {
    test('sums holdings and adds cash', () {
      final v = valueBrokerageAccount(
        holdings: [
          holding(id: 'h1', assetId: 'a', quantity: '10', costBasis: '1000'),
          holding(id: 'h2', assetId: 'b', quantity: '5', costBasis: '500'),
        ],
        pricesByAssetId: {
          'a': price(assetId: 'a', value: '120'), // 1200
          'b': price(assetId: 'b', value: '90'), // 450
        },
        cashBalance: '250',
      );
      expect(D.compare(v.totalMarketValue!, '1650'), 0);
      expect(D.compare(v.totalCostBasis, '1500'), 0);
      expect(D.compare(v.totalUnrealizedGainLoss!, '150'), 0);
      expect(D.compare(v.totalUnrealizedReturnPercent!, '10'), 0);
      expect(D.compare(v.currentValue!, '1900'), 0);
      expect(v.isComplete, isTrue);
    });

    // Summing only the priced holdings against the full cost basis would report
    // a portfolio that is smaller than it is — i.e. a loss the user never took.
    test('one unpriced holding makes the totals unavailable, not partial', () {
      final v = valueBrokerageAccount(
        holdings: [
          holding(id: 'h1', assetId: 'a', quantity: '10', costBasis: '1000'),
          holding(id: 'h2', assetId: 'b', quantity: '5', costBasis: '500'),
        ],
        pricesByAssetId: {'a': price(assetId: 'a', value: '120')},
        cashBalance: '250',
      );
      expect(v.totalMarketValue, isNull);
      expect(v.totalUnrealizedGainLoss, isNull);
      expect(v.currentValue, isNull);
      expect(v.unpricedCount, 1);
      expect(v.isComplete, isFalse);
      // Cost basis is stored, not priced, so it stays known.
      expect(D.compare(v.totalCostBasis, '1500'), 0);
    });

    test('no holdings leaves cash as the value', () {
      final v = valueBrokerageAccount(
        holdings: [],
        pricesByAssetId: {},
        cashBalance: '750',
      );
      expect(D.compare(v.currentValue!, '750'), 0);
      expect(v.isEmpty, isTrue);
      expect(v.isComplete, isTrue);
    });
  });

  group('previewTrade', () {
    test('a buy adds fees to what you pay', () {
      final p = previewTrade(
        side: TradeSide.buy,
        quantity: '10',
        unitPrice: '25.50',
        fees: '4.95',
      );
      expect(D.compare(p.grossAmount!, '255'), 0);
      expect(D.compare(p.assetTotal!, '259.95'), 0);
      expect(D.compare(p.accountTotal!, '259.95'), 0);
    });

    test('a sell takes fees out of what you receive', () {
      final p = previewTrade(
        side: TradeSide.sell,
        quantity: '10',
        unitPrice: '25.50',
        fees: '4.95',
      );
      expect(D.compare(p.assetTotal!, '250.05'), 0);
    });

    test('an fx rate converts the total to the account currency', () {
      final p = previewTrade(
        side: TradeSide.buy,
        quantity: '10',
        unitPrice: '10',
        fees: '0',
        accountFxRate: '48.5',
      );
      expect(D.compare(p.assetTotal!, '100'), 0);
      expect(D.compare(p.accountTotal!, '4850'), 0);
    });

    test('blank fees count as zero', () {
      final p = previewTrade(
        side: TradeSide.buy,
        quantity: '2',
        unitPrice: '50',
        fees: '   ',
      );
      expect(p.fees, '0');
      expect(D.compare(p.assetTotal!, '100'), 0);
    });
  });

  group('MarketPrice.fromRow rejects unusable quotes', () {
    Map<String, dynamic> row(Map<String, dynamic> overrides) => {
      'assetId': 'a1',
      'available': true,
      'provider': 'twelve_data',
      'price': '120.5',
      'currencyCode': 'usd',
      'effectiveAt': '2026-09-09T12:00:00Z',
      'stale': false,
      ...overrides,
    };

    test('accepts a good row and upper-cases the currency', () {
      final p = MarketPrice.fromRow(row({}))!;
      expect(p.currencyCode, 'USD');
      expect(p.price, '120.5');
    });

    for (final (name, override) in <(String, Map<String, dynamic>)>[
      ('unavailable', {'available': false}),
      ('no provider', {'provider': null}),
      ('null price', {'price': null}),
      ('zero price', {'price': '0'}),
      ('negative price', {'price': '-5'}),
      ('bad currency', {'currencyCode': 'US'}),
      ('no timestamp', {'effectiveAt': null}),
    ]) {
      test(name, () => expect(MarketPrice.fromRow(row(override)), isNull));
    }
  });
}
