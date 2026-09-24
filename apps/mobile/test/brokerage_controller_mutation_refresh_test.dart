import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:tharwati_mobile/accounts/accounts_repository.dart';
import 'package:tharwati_mobile/accounts/brokerage/brokerage_activity.dart';
import 'package:tharwati_mobile/accounts/brokerage/brokerage_controller.dart';
import 'package:tharwati_mobile/accounts/brokerage/brokerage_models.dart';
import 'package:tharwati_mobile/accounts/brokerage/brokerage_repository.dart';

class _Repository extends BrokerageRepository {
  _Repository() : super(SupabaseClient('http://127.0.0.1:54321', 'test-key'));

  bool rejectMutation = false;
  bool rejectReads = false;
  int mutationCalls = 0;
  final List<String> keys = [];

  @override
  Future<List<Holding>> getHoldingsForAccount(String accountId) async {
    if (rejectReads) throw Exception('offline');
    return const [];
  }

  @override
  Future<Map<String, MarketPrice>> getPrices(List<String> assetIds) async =>
      const {};

  @override
  Future<String> getCashBalance(String accountId) async {
    if (rejectReads) throw Exception('offline');
    return '125.50';
  }

  @override
  Future<List<ActivityItem>> getActivity(String accountId) async => const [];

  @override
  Future<void> addExistingHolding(
    String accountId,
    ExistingHoldingFormValues value,
    String idempotencyKey,
  ) async {
    mutationCalls += 1;
    keys.add(idempotencyKey);
    if (rejectMutation) throw AccountsException('rejected');
  }

  @override
  Future<void> addBuy(
    String accountId,
    TradeFormValues value,
    String idempotencyKey,
  ) async {
    mutationCalls += 1;
    keys.add(idempotencyKey);
    if (rejectMutation) throw AccountsException('rejected');
  }
}

TradeFormValues _buy({String quantity = '1.00'}) => TradeFormValues(
  side: TradeSide.buy,
  assetId: 'asset',
  quantity: quantity,
  unitPrice: '10.0',
  fees: '',
  occurredAt: '2026-09-24T10:00',
);

void main() {
  test(
    'existing holding uncertain retries reuse keys; committed stale refresh never reposts',
    () async {
      final repository = _Repository()..rejectMutation = true;
      final controller = BrokerageController(
        accountId: 'account',
        repository: repository,
      );
      ExistingHoldingFormValues input(String quantity) =>
          ExistingHoldingFormValues(
            assetId: 'asset',
            quantity: quantity,
            averageCost: '10',
            occurredAt: '2026-09-01T10:00:00Z',
          );
      expect(await controller.addExistingHolding(input('1.0')), isFalse);
      expect(await controller.addExistingHolding(input('1')), isFalse);
      expect(repository.keys[1], repository.keys[0]);
      expect(await controller.addExistingHolding(input('2')), isFalse);
      expect(repository.keys[2], isNot(repository.keys[1]));
      repository.rejectMutation = false;
      repository.rejectReads = true;
      expect(await controller.addExistingHolding(input('2')), isTrue);
      await Future<void>.delayed(Duration.zero);
      expect(repository.keys[3], repository.keys[2]);
      expect(controller.refreshStale, isTrue);
      await controller.retryRefresh();
      expect(repository.mutationCalls, 4);
      expect(await controller.addExistingHolding(input('2')), isTrue);
      expect(repository.keys[4], isNot(repository.keys[3]));
      await Future<void>.delayed(Duration.zero);
      controller.dispose();
    },
  );

  test(
    'committed mutation closes while failed refresh retains known value',
    () async {
      final repository = _Repository();
      final controller = BrokerageController(
        accountId: 'account',
        repository: repository,
      );
      expect(await controller.load(), isTrue);
      expect(controller.valuation?.cashBalance, '125.50');

      repository.rejectReads = true;
      expect(await controller.submitTrade(_buy()), isTrue);
      await Future<void>.delayed(Duration.zero);

      expect(controller.refreshStale, isTrue);
      expect(controller.valuation?.cashBalance, '125.50');
      expect(repository.mutationCalls, 1);

      await controller.retryRefresh();
      expect(repository.mutationCalls, 1);
    },
  );

  test(
    'rejected unchanged payload retains key and changed payload rotates it',
    () async {
      final repository = _Repository()..rejectMutation = true;
      final controller = BrokerageController(
        accountId: 'account',
        repository: repository,
      );

      expect(await controller.submitTrade(_buy()), isFalse);
      expect(await controller.submitTrade(_buy(quantity: '1')), isFalse);
      expect(repository.keys[1], repository.keys[0]);

      expect(await controller.submitTrade(_buy(quantity: '2')), isFalse);
      expect(repository.keys[2], isNot(repository.keys[1]));
      expect(controller.actionError, 'rejected');
    },
  );
}
