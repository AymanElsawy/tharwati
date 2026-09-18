import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/core/decimals.dart';
import 'package:tharwati_mobile/portfolio/portfolio_models.dart';
import 'package:tharwati_mobile/portfolio/portfolio_valuation.dart';

import 'portfolio_test_support.dart';

void main() {
  test('same-currency value, cash and performance use launch contract', () {
    final result = valuePortfolio(source());
    expect(result.investedMarketValueBase, '20');
    expect(result.costBasisBase, '10');
    expect(result.unrealizedGainLossBase, '10');
    expect(result.unrealizedReturnPercent, '100');
    expect(result.availableCashBase, '5');
    expect(result.currentValueBase, '25');
    expect(result.allocation.single.valueBase, '20');
  });

  test('multi-currency supports normalized direct and inverse FX evidence', () {
    for (final direction in ['direct', 'inverse']) {
      final result = valuePortfolio(
        source(
          holdings: [holding('one', 'broker', costCurrency: 'EUR')],
          prices: {'asset-one': price('one', currency: 'EUR')},
          rates: {'EUR/USD': fx('EUR', 'USD', '1.25', direction: direction)},
        ),
      );
      expect(result.investedMarketValueBase, '25');
      expect(result.costBasisBase, '12.5');
    }
  });

  test('cash is excluded from allocation and investment performance', () {
    final result = valuePortfolio(source(cash: {'broker': '1000'}));
    expect(result.currentValueBase, '1020');
    expect(result.allocation.single.valueBase, '20');
    expect(result.unrealizedReturnPercent, '100');
  });

  test('missing Available Cash does not become zero', () {
    final result = valuePortfolio(source(cash: const {}));
    expect(result.investedMarketValueBase, '20');
    expect(result.availableCashBase, isNull);
    expect(result.currentValueBase, isNull);
  });

  test('account scope filters holdings, cash, and grouped evidence', () {
    final result = valuePortfolio(
      source(
        accounts: [account('one'), account('two')],
        holdings: [holding('one', 'one'), holding('two', 'two')],
        cash: {'one': '1', 'two': '99'},
        prices: {'asset-one': price('one'), 'asset-two': price('two')},
      ),
      scopeId: 'one',
    );
    expect(result.accounts.map((item) => item.id), ['one', 'two']);
    expect(result.accountGroups.map((item) => item.account.id), ['one']);
    expect(result.holdings.map((item) => item.holding.id), ['one']);
    expect(result.availableCashBase, '1');
  });

  test('stale price and FX remain visible without becoming unavailable', () {
    final result = valuePortfolio(
      source(
        holdings: [holding('one', 'broker', costCurrency: 'EUR')],
        prices: {'asset-one': price('one', currency: 'EUR', stale: true)},
        rates: {'EUR/USD': fx('EUR', 'USD', '1.2', stale: true)},
      ),
    );
    expect(result.coverage, PortfolioCoverage.complete);
    expect(result.hasStalePrice, isTrue);
    expect(result.hasStaleFx, isTrue);
    expect(result.holdings.single.priceStale, isTrue);
    expect(result.holdings.single.fxStale, isTrue);
  });

  test('missing price makes aggregate and allocation unavailable', () {
    final result = valuePortfolio(source(prices: const {}));
    expect(result.coverage, PortfolioCoverage.unavailable);
    expect(result.investedMarketValueBase, isNull);
    expect(result.currentValueBase, isNull);
    expect(result.allocation, isEmpty);
    expect(result.unavailablePriceAssetIds, {'asset-one'});
  });

  test('one missing FX preserves individually valid holding evidence', () {
    final result = valuePortfolio(
      source(
        holdings: [
          holding('one', 'broker'),
          holding('two', 'broker', costCurrency: 'EUR'),
        ],
        prices: {
          'asset-one': price('one'),
          'asset-two': price('two', currency: 'EUR'),
        },
      ),
    );
    expect(result.coverage, PortfolioCoverage.partial);
    expect(result.holdings.first.isComplete, isTrue);
    expect(result.investedMarketValueBase, isNull);
    expect(result.unavailableFxPairs, {'EUR/USD'});
  });

  test('cash-only account and no-account states remain distinct', () {
    final empty = valuePortfolio(
      source(holdings: const [], prices: const {}, cash: {'broker': '30'}),
    );
    expect(empty.coverage, PortfolioCoverage.empty);
    expect(empty.currentValueBase, '30');
    expect(empty.accountGroups.single.holdings, isEmpty);
    final none = valuePortfolio(
      source(
        accounts: const [],
        holdings: const [],
        cash: const {},
        prices: const {},
      ),
    );
    expect(none.coverage, PortfolioCoverage.noBrokerageAccounts);
  });

  test('decimal-safe allocation percentages total exactly 100', () {
    final result = valuePortfolio(
      source(
        holdings: [
          holding('a', 'broker', quantity: '1', assetType: 'stock'),
          holding('b', 'broker', quantity: '1', assetType: 'etf'),
          holding('c', 'broker', quantity: '1', assetType: 'bond'),
        ],
        prices: {
          'asset-a': price('a', value: '1'),
          'asset-b': price('b', value: '1'),
          'asset-c': price('c', value: '1'),
        },
      ),
    );
    expect(D.sum(result.allocation.map((item) => item.percentage)), '100');
  });
}
