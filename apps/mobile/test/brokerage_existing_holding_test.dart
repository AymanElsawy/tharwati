import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:tharwati_mobile/accounts/brokerage/brokerage_activity.dart';
import 'package:tharwati_mobile/accounts/brokerage/brokerage_controller.dart';
import 'package:tharwati_mobile/accounts/brokerage/brokerage_models.dart';
import 'package:tharwati_mobile/accounts/brokerage/brokerage_repository.dart';
import 'package:tharwati_mobile/core/data_change.dart';

void main() {
  group('existing holding RPC contract', () {
    test('same-currency payload contains only opening-position inputs', () {
      expect(existingHoldingRpcName, 'add_existing_holding_v2');
      final params = existingHoldingRpcParams(
        'account-1',
        ExistingHoldingFormValues(
          assetId: 'asset-1',
          quantity: ' 2.5 ',
          averageCost: ' 101.25 ',
          occurredAt: '2026-09-18T10:30:00Z',
          notes: ' migrated lot ',
        ),
      );

      expect(params, {
        'p_account_id': 'account-1',
        'p_asset_id': 'asset-1',
        'p_quantity': '2.5',
        'p_average_cost': '101.25',
        'p_occurred_at': '2026-09-18T10:30:00.000Z',
        'p_notes': 'migrated lot',
        'p_account_fx_rate': null,
      });
      expect(params.keys, isNot(contains('p_cash_amount')));
    });

    test('cross-currency payload sends the historical FX rate', () {
      final params = existingHoldingRpcParams(
        'account-1',
        ExistingHoldingFormValues(
          assetId: 'asset-1',
          quantity: '2',
          averageCost: '100',
          occurredAt: '2026-09-18T10:30:00Z',
          accountFxRate: ' 3.75 ',
        ),
      );
      expect(params['p_account_fx_rate'], '3.75');
    });
  });

  group('existing holding validation', () {
    ExistingHoldingFormValues valid({String? rate}) =>
        ExistingHoldingFormValues(
          assetId: 'asset-1',
          quantity: '2',
          averageCost: '100',
          occurredAt: '2026-09-18T10:30:00Z',
          accountFxRate: rate,
        );

    test('rejects invalid quantity and historical cost', () {
      final values = valid()
        ..quantity = '0'
        ..averageCost = '-1';
      final errors = validateExistingHolding(values, crossCurrency: false);
      expect(errors, containsPair('quantity', isNotEmpty));
      expect(errors, containsPair('averageCost', isNotEmpty));
    });

    test('same currency needs no FX; cross currency requires positive FX', () {
      expect(validateExistingHolding(valid(), crossCurrency: false), isEmpty);
      expect(
        validateExistingHolding(valid(), crossCurrency: true),
        contains('accountFxRate'),
      );
      expect(
        validateExistingHolding(valid(rate: '0'), crossCurrency: true),
        contains('accountFxRate'),
      );
      expect(
        validateExistingHolding(valid(rate: '3.75'), crossCurrency: true),
        isEmpty,
      );
    });
  });

  test('single-flight submission refreshes holdings/activity, preserves cash, '
      'and emits DataChange', () async {
    final repository = _FakeRepository();
    final controller = BrokerageController(
      accountId: 'account-1',
      repository: repository,
    );
    var changes = 0;
    void changed() => changes += 1;
    DataChange.instance.addListener(changed);
    addTearDown(() {
      DataChange.instance.removeListener(changed);
      controller.dispose();
    });

    final values = ExistingHoldingFormValues(
      assetId: 'asset-1',
      quantity: '2',
      averageCost: '100',
      occurredAt: '2026-09-18T10:30:00Z',
    );
    final first = controller.addExistingHolding(values);
    final duplicate = await controller.addExistingHolding(values);
    expect(duplicate, isFalse);
    expect(repository.addCalls, 1);

    repository.addCompleter.complete();
    expect(await first, isTrue);
    await Future<void>.delayed(Duration.zero);
    expect(repository.holdingsLoads, 1);
    expect(repository.activityLoads, 1);
    expect(controller.valuation?.cashBalance, '250');
    expect(controller.valuation?.holdings, hasLength(1));
    expect(changes, 1);
  });
}

class _FakeRepository extends BrokerageRepository {
  _FakeRepository()
    : super(SupabaseClient('http://127.0.0.1:54321', 'test-anon-key'));

  final addCompleter = Completer<void>();
  int addCalls = 0;
  int holdingsLoads = 0;
  int activityLoads = 0;

  @override
  Future<void> addExistingHolding(
    String accountId,
    ExistingHoldingFormValues values,
    String idempotencyKey,
  ) {
    addCalls += 1;
    return addCompleter.future;
  }

  @override
  Future<List<Holding>> getHoldingsForAccount(String accountId) async {
    holdingsLoads += 1;
    return [_holding()];
  }

  @override
  Future<Map<String, MarketPrice>> getPrices(List<String> assetIds) async => {
    'asset-1': const MarketPrice(
      assetId: 'asset-1',
      price: '120',
      currencyCode: 'USD',
      effectiveAt: '2026-09-18T10:30:00Z',
      provider: 'test',
      priceType: 'delayed',
      stale: false,
    ),
  };

  @override
  Future<String> getCashBalance(String accountId) async => '250';

  @override
  Future<List<ActivityItem>> getActivity(String accountId) async {
    activityLoads += 1;
    return const [];
  }
}

Holding _holding() => const Holding(
  id: 'holding-1',
  accountId: 'account-1',
  assetId: 'asset-1',
  quantity: '2',
  averageCost: '100',
  totalCostBasis: '200',
  costCurrencyCode: 'USD',
  asset: Asset(
    id: 'asset-1',
    name: 'Example',
    symbol: 'EX',
    exchange: 'NASDAQ',
    assetTypeCode: 'stock',
    currencyCode: 'USD',
    canonicalQuantityUnit: 'shares',
  ),
);
