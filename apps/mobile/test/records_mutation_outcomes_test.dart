import 'dart:async';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:tharwati_mobile/accounts/records/records_controller.dart';
import 'package:tharwati_mobile/accounts/records/records_models.dart';
import 'package:tharwati_mobile/accounts/records/records_repository.dart';
import 'package:tharwati_mobile/core/mutation_refresh.dart';
import 'package:tharwati_mobile/core/retained_mutation.dart';
import 'package:tharwati_mobile/i18n/accounts_copy.dart';
import 'package:tharwati_mobile/i18n/app_language.dart';

class Ledger extends RecordsRepository {
  Ledger()
    : super(
        SupabaseClient(
          'http://localhost',
          'test',
          authOptions: const AuthClientOptions(autoRefreshToken: false),
        ),
      );
  final effects = <String>{};
  final keys = <String>[];
  final payloads = <String>[];
  bool loseResponse = false, failRead = false;
  Object? reject;
  Completer<void>? pending;
  int reads = 0;

  Future<void> write(String operation, String key, String payload) async {
    keys.add(key);
    payloads.add(payload);
    if (reject != null) throw reject!;
    final added = effects.add('$operation:$key');
    if (added && loseResponse) throw const SocketException('response lost');
    if (added && pending != null) await pending!.future;
  }

  @override
  Future<void> addRecord(AccountRecordFormValues v, String key) =>
      write(v.type.code, key, v.amount);
  @override
  Future<void> cancelRefund(String id, String key) => write('cancel', key, id);
  @override
  Future<void> addRefund({
    required String expenseId,
    required String amount,
    required String accountId,
    required String occurredAt,
    required String notes,
    required String idempotencyKey,
  }) => write('refund', idempotencyKey, amount);
  @override
  Future<AccountRecordHistoryPage> getHistoryPage(
    String accountId,
    AccountRecordHistoryCursor? cursor,
    int pageSize,
    AccountRecordHistoryFilters filters,
  ) async {
    reads++;
    if (failRead) throw const SocketException('read failed');
    return const AccountRecordHistoryPage(
      records: [],
      nextCursor: null,
      hasMore: false,
    );
  }

  @override
  Future<Map<String, String>> getAccountBalances(List<String> ids) async => {
    'account': '1000',
  };
  @override
  Future<List<RecordCategory>> getCategories() async => [];
  @override
  Future<List<RecordCategoryOverride>> getOverrides() async => [];
}

AccountRecordFormValues values({
  AccountRecordType type = AccountRecordType.income,
  String amount = '1000.50',
}) => AccountRecordFormValues(
  type: type,
  accountId: 'account',
  toAccountId: 'destination',
  amount: amount,
  receivedAmount: amount,
  mainCategoryId: 'main',
  subcategoryId: 'sub',
  occurredAt: '2026-09-26T10:00',
);

Future<bool> submit(RecordsController controller, String operation) =>
    switch (operation) {
      'refund' => controller.addRefund(
        expenseId: 'expense',
        amount: '1000.50',
        accountId: 'account',
        occurredAt: '2026-09-26T10:00',
        notes: '',
        idempotencyKey: '2b2b2b2b-1111-4111-8111-111111111111',
      ),
      'cancel' => controller.cancelRefund('refund'),
      _ => controller.submit(
        values(type: AccountRecordType.values.byName(operation)),
      ),
    };

void main() {
  for (final operation in [
    'income',
    'expense',
    'transfer',
    'refund',
    'cancel',
  ]) {
    test(
      '$operation lost response reuses its key and produces one effect',
      () async {
        final ledger = Ledger()..loseResponse = true;
        final controller = RecordsController(
          accountId: 'account',
          repository: ledger,
        );
        expect(await submit(controller, operation), isFalse);
        expect(controller.mutationOutcome, isA<MutationUncertain>());
        expect(
          controller.actionError,
          AccountsCopy.of(AppLanguage.en).mutationUncertain,
        );
        expect(ledger.keys, hasLength(1)); // no automatic retry
        expect(ledger.reads, 0);
        expect(await submit(controller, operation), isTrue);
        expect(controller.mutationOutcome, isA<MutationCommitted>());
        expect(ledger.keys[0], ledger.keys[1]);
        expect(ledger.effects, hasLength(1));
        controller.dispose();
      },
    );
  }

  test(
    'explicit business rejection is rejected and exposes no server text',
    () async {
      final ledger = Ledger()
        ..reject = const PostgrestException(
          message: 'private SQL/RPC details',
          code: 'P0001',
        );
      final controller = RecordsController(
        accountId: 'account',
        repository: ledger,
      );
      expect(await controller.submit(values()), isFalse);
      expect(controller.mutationOutcome, isA<MutationRejected>());
      expect(controller.actionError, isNot(contains('private')));
      expect(ledger.reads, 0);
      expect(ledger.effects, isEmpty);
      controller.dispose();
    },
  );

  test(
    'changed command rotates key without overwriting unresolved original',
    () async {
      final ledger = Ledger()..loseResponse = true;
      final controller = RecordsController(
        accountId: 'account',
        repository: ledger,
      );
      await controller.submit(values());
      await controller.submit(values(amount: '2000'));
      expect(ledger.keys[0], isNot(ledger.keys[1]));
      await controller.submit(values(amount: '1000.500'));
      expect(ledger.keys[2], ledger.keys[0]);
      expect(ledger.effects, hasLength(2));
      expect(controller.hasUncertainMutation, isTrue);
      controller.dispose();
    },
  );

  testWidgets(
    '45-second deadline; late success confirms original without changing newer form',
    (tester) async {
      final response = Completer<void>();
      final ledger = Ledger()..pending = response;
      final controller = RecordsController(
        accountId: 'account',
        repository: ledger,
      );
      var current = true;
      var closes = 0;
      final run = controller.submit(
        values(),
        isCurrent: () => current,
        onCommitted: () => closes++,
      );
      await tester.pump(const Duration(seconds: 44));
      expect(controller.busy, isTrue);
      await tester.pump(const Duration(seconds: 1));
      expect(await run, isFalse);
      expect(controller.mutationOutcome, isA<MutationUncertain>());
      current = false; // original edited or dismissed
      controller.clearActionError(); // next form owns UI
      response.complete();
      await tester.pump();
      expect(closes, 0);
      expect(controller.actionError, isNull);
      expect(ledger.keys, hasLength(1));
      // The retained original is now committed: confirming it performs reads only.
      expect(await controller.submit(values()), isTrue);
      expect(ledger.keys, hasLength(1));
      controller.dispose();
    },
  );

  testWidgets('late success may close only its unchanged original form', (
    tester,
  ) async {
    final response = Completer<void>();
    final ledger = Ledger()..pending = response;
    final controller = RecordsController(
      accountId: 'account',
      repository: ledger,
    );
    var closes = 0;
    final run = controller.submit(
      values(),
      isCurrent: () => true,
      onCommitted: () => closes++,
    );
    await tester.pump(ledgerWriteDeadline);
    expect(await run, isFalse);
    response.complete();
    await tester.pump();
    expect(closes, 1);
    expect(controller.mutationOutcome, isA<MutationCommitted>());
    expect(controller.actionError, isNull);
    controller.dispose();
  });

  test('confirmed save plus failed refresh retries reads only', () async {
    final ledger = Ledger()..failRead = true;
    final controller = RecordsController(
      accountId: 'account',
      repository: ledger,
    );
    expect(await controller.submit(values()), isTrue);
    expect(controller.mutationOutcome, isA<MutationCommittedRefreshFailed>());
    expect(controller.refreshStale, isTrue);
    ledger.failRead = false;
    expect(await controller.submit(values()), isTrue);
    await controller.retryRefresh();
    expect(controller.mutationOutcome, isA<MutationCommitted>());
    expect(ledger.keys, hasLength(1));
    expect(ledger.reads, 3);
    controller.dispose();
  });

  testWidgets(
    'payload is captured before dispatch and late error cannot undo replay',
    (tester) async {
      final response = Completer<void>();
      final ledger = Ledger()..pending = response;
      final controller = RecordsController(
        accountId: 'account',
        repository: ledger,
      );
      final form = values(amount: '9007199254740993.01');
      final run = controller.submit(form);
      form.amount = '1';
      await tester.pump(ledgerWriteDeadline);
      expect(await run, isFalse);
      expect(ledger.payloads.single, '9007199254740993.01');
      expect(
        await controller.submit(values(amount: '9007199254740993.01')),
        isTrue,
      );
      response.completeError(
        const PostgrestException(message: 'rejected', code: '23514'),
      );
      await tester.pump();
      expect(controller.mutationOutcome, isA<MutationCommitted>());
      expect(ledger.effects, hasLength(1));
      controller.dispose();
    },
  );

  testWidgets(
    'late original success cannot overwrite a newer uncertain submission',
    (tester) async {
      final response = Completer<void>();
      final ledger = Ledger()..pending = response;
      final controller = RecordsController(
        accountId: 'account',
        repository: ledger,
      );
      final original = controller.submit(values());
      await tester.pump(ledgerWriteDeadline);
      expect(await original, isFalse);
      await tester.pump(const Duration(seconds: 90));
      expect(ledger.keys, hasLength(1));
      ledger.pending = null;
      ledger.loseResponse = true;
      expect(await controller.submit(values(amount: '2000')), isFalse);
      final newError = controller.actionError;
      response.complete();
      await tester.pump();
      expect(controller.actionError, newError);
      expect(controller.mutationOutcome, isA<MutationUncertain>());
      expect(controller.hasUncertainMutation, isTrue);
      expect(await controller.submit(values()), isTrue);
      expect(
        ledger.keys,
        hasLength(2),
      ); // old attempt was confirmed, reads only
      controller.dispose();
    },
  );

  testWidgets(
    'older late rejection clears its warning without changing a newer mutation',
    (tester) async {
      final response = Completer<void>();
      final ledger = Ledger()..pending = response;
      final controller = RecordsController(
        accountId: 'account',
        repository: ledger,
      );
      var oldFormCloses = 0;
      final original = controller.submit(
        values(),
        isCurrent: () => false,
        onCommitted: () => oldFormCloses++,
      );
      await tester.pump(ledgerWriteDeadline);
      expect(await original, isFalse);
      expect(controller.hasUncertainMutation, isTrue);

      ledger.pending = null;
      ledger.reject = const PostgrestException(
        message: 'newer form rejection',
        code: 'P0001',
      );
      expect(await controller.submit(values(amount: '2000')), isFalse);
      final newerOutcome = controller.mutationOutcome;
      final newerError = controller.actionError;
      expect(newerOutcome, isA<MutationRejected>());
      expect(controller.hasUncertainMutation, isTrue);
      var notifications = 0;
      controller.addListener(() => notifications++);

      response.completeError(
        const PostgrestException(message: 'late rejection', code: 'P0002'),
      );
      await tester.pump();
      expect(controller.hasUncertainMutation, isFalse);
      expect(notifications, 1);
      expect(controller.mutationOutcome, same(newerOutcome));
      expect(controller.actionError, newerError);
      expect(controller.busy, isFalse);
      expect(oldFormCloses, 0);
      expect(ledger.keys, hasLength(2));
      controller.dispose();
    },
  );

  testWidgets('a refresh is outside the write deadline', (tester) async {
    final owner = RetainedMutations();
    var writes = 0;
    final read = Completer<void>();
    final attempt = owner.prepare('record', 'payload', (_) async {
      writes++;
    });
    final run = owner.run(
      attempt,
      refresh: () => read.future,
      errorMessage: (_) => 'Safe error',
    );
    await tester.pump(const Duration(seconds: 90));
    expect(attempt.outcome, isA<MutationCommitted>());
    read.completeError(StateError('read failed'));
    await tester.pump();
    expect(await run, isA<MutationCommittedRefreshFailed>());
    expect(writes, 1);
  });

  testWidgets('late explicit rejection resolves only its timed-out delivery', (
    tester,
  ) async {
    final owner = RetainedMutations();
    final response = Completer<void>();
    final attempt = owner.prepare(
      'refund.cancel',
      'refund',
      (_) => response.future,
    );
    final run = owner.run(
      attempt,
      refresh: () async {},
      errorMessage: (_) => 'Safe rejection',
    );
    await tester.pump(ledgerWriteDeadline);
    expect(await run, isA<MutationUncertain>());
    response.completeError(
      const PostgrestException(message: 'private detail', code: 'P0002'),
    );
    await tester.pump();
    expect(attempt.outcome, isA<MutationRejected>());
    expect((attempt.outcome as MutationRejected).message, 'Safe rejection');
  });

  testWidgets('disposed owner is not updated by a late success', (
    tester,
  ) async {
    final response = Completer<void>();
    final ledger = Ledger()..pending = response;
    final controller = RecordsController(
      accountId: 'account',
      repository: ledger,
    );
    var closes = 0;
    final run = controller.submit(values(), onCommitted: () => closes++);
    await tester.pump(ledgerWriteDeadline);
    expect(await run, isFalse);
    controller.dispose();
    response.complete();
    await tester.pump();
    expect(closes, 0);
    expect(ledger.reads, 0);
    expect(tester.takeException(), isNull);
  });

  test('uncertainty copy is localized in Arabic', () async {
    final ledger = Ledger()..loseResponse = true;
    final controller = RecordsController(
      accountId: 'account',
      repository: ledger,
      language: () => AppLanguage.ar,
    );
    await controller.submit(values());
    expect(
      controller.actionError,
      AccountsCopy.of(AppLanguage.ar).mutationUncertain,
    );
    expect(
      controller.actionError,
      isNot(AccountsCopy.of(AppLanguage.en).mutationUncertain),
    );
    controller.dispose();
  });
}
