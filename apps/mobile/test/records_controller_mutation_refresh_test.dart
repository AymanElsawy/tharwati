import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:tharwati_mobile/accounts/records/records_controller.dart';
import 'package:tharwati_mobile/accounts/records/records_models.dart';
import 'package:tharwati_mobile/accounts/records/records_repository.dart';

class _FakeRecordsRepository extends RecordsRepository {
  _FakeRecordsRepository()
    : super(SupabaseClient('http://localhost', 'sb_publishable_test'));

  var failLoads = false;
  var rejectMutation = false;
  var mutationCalls = 0;
  final cancellationKeys = <String>[];
  final creationKeys = <String>[];
  var rejectCreates = false;

  static const record = AccountRecord(
    id: 'record',
    occurredAt: '2026-09-22T10:00:00Z',
    type: 'expense',
    isEditable: true,
    description: 'Expense',
    notes: null,
    mainCategoryId: null,
    subcategoryId: null,
    amount: '-10',
    currencyCode: 'USD',
    localDate: '2026-09-22',
    dailyNet: '-10',
  );

  @override
  Future<AccountRecordHistoryPage> getHistoryPage(
    String accountId,
    AccountRecordHistoryCursor? cursor,
    int pageSize,
    AccountRecordHistoryFilters filters,
  ) async {
    if (failLoads) throw StateError('offline');
    return const AccountRecordHistoryPage(
      records: [record],
      nextCursor: null,
      hasMore: false,
    );
  }

  @override
  Future<Map<String, String>> getAccountBalances(List<String> ids) async => {
    'account': '90',
  };

  @override
  Future<List<RecordCategory>> getCategories() async => const [];

  @override
  Future<List<RecordCategoryOverride>> getOverrides() async => const [];

  @override
  Future<void> reverseRecord(String recordId) async {
    mutationCalls += 1;
    if (rejectMutation) throw StateError('rejected');
  }

  @override
  Future<void> addRecord(
    AccountRecordFormValues values,
    String idempotencyKey,
  ) async {
    creationKeys.add('${values.amount}:$idempotencyKey');
    if (rejectCreates) throw StateError('ambiguous');
  }

  @override
  Future<void> cancelRefund(String recordId, String idempotencyKey) async {
    cancellationKeys.add('$recordId:$idempotencyKey');
    throw StateError('rejected');
  }
}

void main() {
  test(
    'committed mutation survives refresh failure and retry is refresh-only',
    () async {
      final repository = _FakeRecordsRepository();
      final controller = RecordsController(
        accountId: 'account',
        repository: repository,
      );
      await controller.load();
      repository.failLoads = true;

      expect(await controller.reverse('record'), isTrue);
      await Future<void>.delayed(Duration.zero);
      expect(controller.records, [_FakeRecordsRepository.record]);
      expect(controller.refreshStale, isTrue);
      expect(controller.accountBalance, '90');
      expect(repository.mutationCalls, 1);

      await controller.retryRefresh();
      expect(repository.mutationCalls, 1);
      expect(controller.records, [_FakeRecordsRepository.record]);
      controller.dispose();
    },
  );

  test('rejected mutation remains rejected and does not refresh', () async {
    final repository = _FakeRecordsRepository()..rejectMutation = true;
    final controller = RecordsController(
      accountId: 'account',
      repository: repository,
    );

    expect(await controller.reverse('record'), isFalse);
    expect(controller.actionError, isNotNull);
    expect(controller.refreshStale, isFalse);
    controller.dispose();
  });

  test('refund cancellation key is stable until the target changes', () async {
    final repository = _FakeRecordsRepository();
    final controller = RecordsController(
      accountId: 'account',
      repository: repository,
    );

    await controller.cancelRefund('refund-1');
    await controller.cancelRefund('refund-1');
    await controller.cancelRefund('refund-2');

    final firstKey = repository.cancellationKeys[0].split(':').last;
    final retryKey = repository.cancellationKeys[1].split(':').last;
    final changedKey = repository.cancellationKeys[2].split(':').last;
    expect(retryKey, firstKey);
    expect(changedKey, isNot(firstKey));
    controller.dispose();
  });

  test('record create reuses a key until normalized payload changes', () async {
    final repository = _FakeRecordsRepository()..rejectCreates = true;
    final controller = RecordsController(
      accountId: 'account',
      repository: repository,
    );
    final initial = AccountRecordFormValues(
      type: AccountRecordType.expense,
      accountId: 'account',
      amount: '10.00',
      mainCategoryId: 'main',
      subcategoryId: 'sub',
      occurredAt: '2026-09-23T10:30',
    );

    expect(await controller.submit(initial), isFalse);
    expect(await controller.submit(initial.copy()..amount = '10.0'), isFalse);
    expect(await controller.submit(initial.copy()..amount = '11'), isFalse);

    final firstKey = repository.creationKeys[0].split(':').last;
    final retryKey = repository.creationKeys[1].split(':').last;
    final changedKey = repository.creationKeys[2].split(':').last;
    expect(retryKey, firstKey);
    expect(changedKey, isNot(firstKey));
    controller.dispose();
  });

  test('committed record create is not repeated by refresh retry', () async {
    final repository = _FakeRecordsRepository()..failLoads = true;
    final controller = RecordsController(
      accountId: 'account',
      repository: repository,
    );
    final submitted = await controller.submit(
      AccountRecordFormValues(
        type: AccountRecordType.income,
        accountId: 'account',
        amount: '10',
        mainCategoryId: 'main',
        subcategoryId: 'sub',
        occurredAt: '2026-09-23T10:30',
      ),
    );

    expect(submitted, isTrue);
    await Future<void>.delayed(Duration.zero);
    expect(controller.refreshStale, isTrue);
    expect(repository.creationKeys, hasLength(1));
    await controller.retryRefresh();
    expect(repository.creationKeys, hasLength(1));
    controller.dispose();
  });
}
