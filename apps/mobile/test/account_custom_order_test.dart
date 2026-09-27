import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:tharwati_mobile/accounts/account_custom_order.dart';
import 'package:tharwati_mobile/accounts/account_models.dart';
import 'package:tharwati_mobile/accounts/account_valuation.dart';
import 'package:tharwati_mobile/accounts/accounts_controller.dart';
import 'package:tharwati_mobile/accounts/accounts_repository.dart';
import 'package:tharwati_mobile/accounts/accounts_service.dart';
import 'package:tharwati_mobile/accounts/metal_purchases_repository.dart';
import 'package:tharwati_mobile/dashboard/data/dashboard_repository.dart';
import 'package:tharwati_mobile/i18n/accounts_copy.dart';
import 'package:tharwati_mobile/i18n/app_language.dart';

class _Service extends AccountsService {
  _Service(SupabaseClient client, this.next)
    : super(
        accounts: AccountsRepository(client),
        metal: MetalPurchasesRepository(client),
        dashboard: DashboardRepository(client),
      );

  AccountsListModel next;
  Object? writeError;
  bool failRead = false;
  Completer<void>? writeGate;
  int writes = 0;
  int reads = 0;
  List<String>? expected;
  List<String>? ordered;

  @override
  Future<AccountsListModel> loadAccounts() async {
    reads++;
    if (failRead) throw Exception('offline');
    return next;
  }

  @override
  Future<List<String>> reorderAccounts(
    List<String> expectedIds,
    List<String> orderedIds,
  ) async {
    writes++;
    expected = [...expectedIds];
    ordered = [...orderedIds];
    if (writeGate != null) await writeGate!.future;
    if (writeError != null) throw writeError!;
    next = AccountsListModel(items: next.items, canonicalIds: orderedIds);
    return orderedIds;
  }
}

AccountItem _item(
  String id,
  String type,
  String name, {
  bool active = true,
  bool sold = false,
}) => AccountItem(
  account: Account.fromRow({
    'id': id,
    'account_type_code': type,
    'name': name,
    'currency_code': 'USD',
    'opening_balance': '0',
    'is_active': active,
    'closed_reason': sold ? 'sold' : null,
    'created_at': '2026-01-01T00:00:00Z',
  }),
  value: const ResolvedValue('10', CurrentValueSource.ledger),
  lifecycle: null,
);

final _items = [
  _item('gold', 'gold', 'Gold'),
  _item('closed', 'other', 'Closed', active: false),
  _item('cash', 'cash', 'Cash'),
  _item('sold', 'real_estate', 'Sold', active: false, sold: true),
  _item('bank', 'bank', 'Bank'),
];

AccountsListModel _model(List<String> order, [List<AccountItem>? items]) =>
    AccountsListModel(items: items ?? _items, canonicalIds: order);

void main() {
  late SupabaseClient client;
  late _Service service;
  late AccountsController controller;

  setUp(() async {
    client = SupabaseClient(
      'http://localhost:54321',
      'test-key',
      authOptions: const AuthClientOptions(autoRefreshToken: false),
    );
    service = _Service(
      client,
      _model(['bank', 'closed', 'cash', 'sold', 'gold']),
    );
    controller = AccountsController(service: service);
    await Future<void>.delayed(Duration.zero);
  });

  tearDown(() async {
    controller.dispose();
    await client.dispose();
  });

  test(
    'Custom defaults to complete mixed-type server order and matches Web slots',
    () {
      expect(controller.sort, AccountSort.custom);
      expect(controller.hasCompleteOrder, isTrue);
      expect(controller.activeItems.map((e) => e.account.id), [
        'bank',
        'cash',
        'gold',
      ]);
      expect(controller.closedItems.map((e) => e.account.id), ['closed']);
      expect(controller.soldItems.map((e) => e.account.id), ['sold']);
      expect(
        reorderAccountSection(
          controller.canonicalIds,
          ['bank', 'cash', 'gold'],
          0,
          2,
        ),
        ['cash', 'closed', 'gold', 'sold', 'bank'],
      );
    },
  );

  test('complete payload preserves hidden Closed and Sold slots', () async {
    expect(controller.showClosed, isFalse);
    expect(await controller.reorderSection(['bank', 'closed'], 0, 1), isFalse);
    expect(service.writes, 0);
    expect(
      await controller.reorderSection(['bank', 'cash', 'gold'], 0, 2),
      isTrue,
    );
    expect(service.expected, ['bank', 'closed', 'cash', 'sold', 'gold']);
    expect(service.ordered, ['cash', 'closed', 'gold', 'sold', 'bank']);
    expect(controller.canonicalIds, service.ordered);
    expect(service.writes, 1);
    expect(
      await controller.reorderSection(['cash', 'gold', 'bank'], 2, 2),
      isFalse,
    );
    expect(service.writes, 1);
  });

  test('temporary Name, Type, and Current Value sorts never write', () {
    for (final sort in [
      AccountSort.name,
      AccountSort.type,
      AccountSort.balance,
    ]) {
      controller.toggleSort(sort);
      expect(controller.canReorder, isFalse);
      expect(service.writes, 0);
    }
    controller.toggleSort(AccountSort.custom);
    expect(controller.activeItems.map((e) => e.account.id), [
      'bank',
      'cash',
      'gold',
    ]);
    expect(service.writes, 0);
  });

  test(
    'subset filters disable writes while preserving Custom display',
    () async {
      controller.setSearch('bank');
      expect(controller.activeItems.map((e) => e.account.id), ['bank']);
      expect(controller.canReorder, isFalse);
      expect(await controller.reorderSection(['bank'], 0, 1), isFalse);
      controller.setSearch('');
      controller.setTypeFilter(AccountType.bank);
      expect(controller.canReorder, isFalse);
      controller.setTypeFilter(null);
      controller.setCurrencyFilter('SAR');
      expect(controller.canReorder, isFalse);
      expect(service.writes, 0);
    },
  );

  test(
    'conflict reloads authoritative order and keeps safe localized notice',
    () async {
      service.writeError = AccountOrderConflict();
      service.next = _model(['gold', 'closed', 'cash', 'sold', 'bank']);
      expect(
        await controller.reorderSection(['bank', 'cash', 'gold'], 0, 2),
        isFalse,
      );
      expect(controller.canonicalIds, [
        'gold',
        'closed',
        'cash',
        'sold',
        'bank',
      ]);
      expect(controller.orderNotice, AccountOrderNotice.conflict);
      expect(
        AccountsCopy.of(AppLanguage.en).orderConflict,
        isNot(contains('PT409')),
      );
      expect(
        AccountsCopy.of(AppLanguage.ar).orderConflict,
        contains('الحسابات'),
      );
    },
  );

  test('ordinary failure restores authoritative order', () async {
    service.writeError = Exception('raw backend detail');
    expect(
      await controller.reorderSection(['bank', 'cash', 'gold'], 0, 2),
      isFalse,
    );
    expect(controller.canonicalIds, ['bank', 'closed', 'cash', 'sold', 'gold']);
    expect(controller.orderNotice, AccountOrderNotice.failure);
    expect(
      AccountsCopy.of(AppLanguage.en).orderFailure,
      isNot(contains('raw backend detail')),
    );
  });

  test(
    'failed authoritative refresh restores the prior order and blocks drag',
    () async {
      service.writeError = Exception('write failed');
      service.failRead = true;
      expect(
        await controller.reorderSection(['bank', 'cash', 'gold'], 0, 2),
        isFalse,
      );
      expect(controller.canonicalIds, [
        'bank',
        'closed',
        'cash',
        'sold',
        'gold',
      ]);
      expect(controller.orderNotice, AccountOrderNotice.refreshFailure);
      expect(controller.canReorder, isFalse);
    },
  );

  test('overlapping reorder writes are blocked', () async {
    service.writeGate = Completer<void>();
    final first = controller.reorderSection(['bank', 'cash', 'gold'], 0, 2);
    expect(controller.isReordering, isTrue);
    expect(
      await controller.reorderSection(['cash', 'gold', 'bank'], 0, 2),
      isFalse,
    );
    service.writeGate!.complete();
    expect(await first, isTrue);
    expect(service.writes, 1);
  });

  test(
    'refresh places created account at canonical end and updates lifecycle sections',
    () async {
      service.next = _model(
        ['bank', 'closed', 'cash', 'sold', 'gold', 'new'],
        [..._items, _item('new', 'brokerage', 'New')],
      );
      await controller.load();
      expect(controller.activeItems.last.account.id, 'new');
      service.next = _model(
        ['bank', 'closed', 'cash', 'sold', 'gold', 'new'],
        [
          _item('gold', 'gold', 'Gold'),
          _item('closed', 'other', 'Closed', active: false),
          _item('cash', 'cash', 'Cash', active: false),
          _item('sold', 'real_estate', 'Sold', active: false, sold: true),
          _item('bank', 'bank', 'Bank'),
          _item('new', 'brokerage', 'New'),
        ],
      );
      await controller.load();
      expect(controller.closedItems.map((e) => e.account.id), [
        'closed',
        'cash',
      ]);
      service.next = _model(
        ['bank', 'closed', 'cash', 'sold', 'gold', 'new'],
        [..._items, _item('new', 'brokerage', 'New')],
      );
      await controller.load();
      expect(controller.activeItems.map((e) => e.account.id), [
        'bank',
        'cash',
        'gold',
        'new',
      ]);
      service.next = _model(
        ['bank', 'cash', 'sold', 'gold', 'new'],
        [
          ..._items.where((e) => e.account.id != 'closed'),
          _item('new', 'brokerage', 'New'),
        ],
      );
      await controller.load();
      expect(controller.hasCompleteOrder, isTrue);
      expect(controller.canonicalIds, isNot(contains('closed')));
    },
  );

  test('incomplete canonical snapshot cannot be persisted', () async {
    service.next = _model(['bank', 'cash']);
    await controller.load();
    expect(controller.canReorder, isFalse);
    expect(service.writes, 0);
  });
}
