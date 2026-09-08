import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/dashboard/data/account_summary.dart';
import 'package:tharwati_mobile/dashboard/data/dashboard_snapshot.dart';
import 'package:tharwati_mobile/dashboard/logic/dashboard_aggregate.dart';

DashboardSnapshot snap({
  required Map<String, String?> currentValues,
  Map<String, String> balances = const {},
  Map<String, String?> rates = const {},
}) {
  return DashboardSnapshot.parse({
    'asOf': '2026-09-08T00:00:00.000Z',
    'expiresAt': '2026-09-08T00:15:00.000Z',
    'freshness': 'fresh',
    'currentValues': currentValues,
    'accountBalances': balances,
    'rates': rates,
    'unavailableSources': <String>[],
    'portfolioAllocation': {'status': 'complete', 'holdings': <dynamic>[]},
  });
}

AccountSummary acc(
  String id,
  String type,
  String ccy, {
  String? bankSubtype,
  String? creditLimit,
}) => AccountSummary(
  id: id,
  accountTypeCode: type,
  name: id,
  currencyCode: ccy,
  openingBalance: '0',
  isActive: true,
  bankSubtype: bankSubtype,
  creditCardLimit: creditLimit,
);

void main() {
  test('complete aggregate sums grouped base-currency values', () {
    final accounts = [
      acc('a', 'cash', 'EGP'),
      acc('b', 'brokerage', 'EGP'),
      acc('c', 'gold', 'EGP'),
    ];
    final result = calculateDashboardAggregate(
      baseCurrencyCode: 'EGP',
      accounts: accounts,
      snapshot: snap(
        currentValues: {'a': '1000.00', 'b': '2500.50', 'c': '331457'},
      ),
    );

    // D returns canonical decimals (trailing zeros trimmed); display formatting
    // re-pads to 2 dp. Values are equal to the web's, just not string-identical.
    expect(result.status, AggregateStatus.complete);
    expect(result.totalAssets, '334957.5');
    expect(result.totalLiabilities, '0');
    expect(result.netWorth, '334957.5');
    expect(result.assetBreakdown[AssetGroup.cashAndBank], '1000');
    expect(result.assetBreakdown[AssetGroup.brokerage], '2500.5');
    expect(result.accountCount, 3);
  });

  test('converts non-base currency via the snapshot rate map', () {
    final result = calculateDashboardAggregate(
      baseCurrencyCode: 'EGP',
      accounts: [acc('u', 'cash', 'USD')],
      snapshot: snap(currentValues: {'u': '100'}, rates: {'USD/EGP': '48'}),
    );
    expect(result.status, AggregateStatus.complete);
    expect(result.assetBreakdown[AssetGroup.cashAndBank], '4800');
  });

  test(
    'a missing rate makes the whole aggregate incomplete (no partial total)',
    () {
      final result = calculateDashboardAggregate(
        baseCurrencyCode: 'EGP',
        accounts: [
          acc('a', 'cash', 'EGP'),
          acc('u', 'cash', 'USD'), // no USD/EGP rate
        ],
        snapshot: snap(currentValues: {'a': '1000', 'u': '100'}),
      );
      expect(result.status, AggregateStatus.incomplete);
      expect(result.totalAssets, isNull);
      expect(result.netWorth, isNull);
      expect(result.unavailablePairs, contains('USD/EGP'));
    },
  );

  test('a null account value makes the aggregate incomplete', () {
    final result = calculateDashboardAggregate(
      baseCurrencyCode: 'EGP',
      accounts: [acc('a', 'real_estate', 'EGP')],
      snapshot: snap(currentValues: {'a': null}),
    );
    expect(result.status, AggregateStatus.incomplete);
    expect(result.unavailableSources, contains('a'));
  });

  test('bank credit becomes a liability, excluded from assets', () {
    final result = calculateDashboardAggregate(
      baseCurrencyCode: 'EGP',
      accounts: [
        acc('cash', 'cash', 'EGP'),
        acc(
          'card',
          'bank',
          'EGP',
          bankSubtype: 'credit',
          creditLimit: '100000',
        ),
      ],
      snapshot: snap(
        currentValues: {'cash': '5000', 'card': null},
        balances: {'card': '15801'},
      ),
    );
    expect(result.status, AggregateStatus.complete);
    expect(result.totalAssets, '5000');
    expect(result.totalLiabilities, '84199'); // 100000 - 15801
    expect(result.netWorth, '-79199');
  });
}
