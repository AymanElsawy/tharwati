import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:tharwati_mobile/core/local_datetime.dart';
import 'package:tharwati_mobile/accounts/records/record_form_sheet.dart';
import 'package:tharwati_mobile/accounts/records/account_records_page.dart';
import 'package:tharwati_mobile/accounts/records/records_models.dart';
import 'package:tharwati_mobile/accounts/records/records_controller.dart';
import 'package:tharwati_mobile/accounts/records/records_repository.dart';
import 'package:tharwati_mobile/accounts/records/records_service.dart';
import 'package:tharwati_mobile/accounts/records/refund_submission.dart';
import 'package:tharwati_mobile/i18n/accounts_copy.dart';
import 'package:tharwati_mobile/i18n/app_language.dart';

class _PendingRefundCategoriesRepository extends RecordsRepository {
  _PendingRefundCategoriesRepository()
    : super(SupabaseClient('http://localhost', 'sb_publishable_test'));

  final categoriesResult = Completer<List<RecordCategory>>();

  @override
  Future<AccountRecordHistoryPage> getHistoryPage(
    String accountId,
    AccountRecordHistoryCursor? cursor,
    int pageSize,
    AccountRecordHistoryFilters filters,
  ) async => AccountRecordHistoryPage(
    records: [
      AccountRecord.fromHistoryRow({
        'id': 'refund',
        'occurred_at': '2026-09-22T10:15:00Z',
        'transaction_type_code': 'refund',
        'description': 'Refund: Expense: Café & Bar',
        'subcategory_id': 'cafe',
        'account_amount': '25',
        'entry_side': 'debit',
        'currency_code': 'SAR',
        'local_date': '2026-09-22',
        'daily_net': '25',
      })!,
    ],
    nextCursor: null,
    hasMore: false,
  );

  @override
  Future<Map<String, String>> getAccountBalances(List<String> ids) async => {
    'account': '25',
  };

  @override
  Future<List<RecordCategory>> getCategories() => categoriesResult.future;

  @override
  Future<List<RecordCategoryOverride>> getOverrides() async => const [];
}

void main() {
  test('history render waits for the final Refund category title', () async {
    final repository = _PendingRefundCategoriesRepository();
    final controller = RecordsController(
      accountId: 'account',
      repository: repository,
    );
    final loading = controller.load();
    await Future<void>.delayed(Duration.zero);

    expect(controller.status, RecordsStatus.ready);
    final refund = controller.records.single;
    expect(
      accountRecordCategoryLabel(
        refund,
        controller.categories,
        categoriesResolved: controller.categoriesResolved,
      ),
      '—',
    );
    expect(refund.amount, '25');
    expect(AccountsCopy.of(AppLanguage.en).recordTypeValue(refund.type), 'Refund');

    repository.categoriesResult.complete(const [
      RecordCategory(
        id: 'dining',
        userId: null,
        parentId: null,
        systemCode: 'dining',
        level: 'main',
        name: 'Dining',
        sortOrder: 0,
        isArchived: false,
      ),
      RecordCategory(
        id: 'cafe',
        userId: null,
        parentId: 'dining',
        systemCode: 'cafe',
        level: 'subcategory',
        name: 'Café & Bar',
        sortOrder: 0,
        isArchived: false,
      ),
    ]);
    await loading;
    expect(controller.categoriesResolved, isTrue);
    expect(
      accountRecordCategoryLabel(
        refund,
        controller.categories,
        categoriesResolved: controller.categoriesResolved,
      ),
      'Café & Bar',
    );
    controller.dispose();
  });

  test('same-time Refund remains above its Expense in grouped history', () {
    AccountRecord record(String id, String type) =>
        AccountRecord.fromHistoryRow({
          'id': id,
          'occurred_at': '2026-09-22T10:15:00Z',
          'transaction_type_code': type,
          'description': type,
          'account_amount': type == 'refund' ? '25' : '100',
          'entry_side': type == 'refund' ? 'debit' : 'credit',
          'currency_code': 'USD',
          'local_date': '2026-09-22',
          'daily_net': '-75',
        })!;

    final groups = groupAccountRecordsByLocalDate([
      record('refund', 'refund'),
      record('expense', 'expense'),
    ]);

    expect(groups.single.records.map((item) => item.id), ['refund', 'expense']);
    expect(groups.single.dailyNet, '-75');
  });

  test('Refund maps as a distinct positive non-editable record', () {
    final row = AccountRecord.fromHistoryRow({
      'id': 'r',
      'occurred_at': '2026-01-01T00:00:00Z',
      'transaction_type_code': 'refund',
      'description': 'Refund',
      'account_amount': '25',
      'entry_side': 'debit',
      'currency_code': 'USD',
      'local_date': '2026-01-01',
      'daily_net': '25',
    });
    expect(row!.type, 'refund');
    expect(row.amount, '25');
    expect(row.isEditable, isFalse);
    expect(AccountsCopy.of(AppLanguage.en).recordTypeValue(row.type), 'Refund');
  });

  test('Refund title stays neutral until async category enrichment finishes', () {
    final refund = AccountRecord.fromHistoryRow({
      'id': 'refund',
      'occurred_at': '2026-09-22T10:15:00Z',
      'transaction_type_code': 'refund',
      'description': 'Refund: Expense: Café & Bar',
      'subcategory_id': 'cafe',
      'account_amount': '25',
      'entry_side': 'debit',
      'currency_code': 'SAR',
      'local_date': '2026-09-22',
      'daily_net': '25',
    })!;

    expect(
      accountRecordCategoryLabel(refund, const [], categoriesResolved: false),
      '—',
    );
    expect(
      accountRecordCategoryLabel(refund, const [], categoriesResolved: true),
      'Café & Bar',
    );
    final categories = [
      const VisibleRecordMainCategory(
        id: 'dining',
        name: 'Dining',
        sortOrder: 0,
        subcategories: [
          VisibleRecordSubcategory(id: 'cafe', name: 'Café & Bar'),
        ],
      ),
    ];
    expect(accountRecordCategoryLabel(refund, categories), 'Café & Bar');
    expect(refund.amount, '25');
    expect(refund.isEditable, isFalse);
    expect(AccountsCopy.of(AppLanguage.en).recordTypeValue(refund.type), 'Refund');
  });

  test('Refund without a category uses its loaded description immediately', () {
    final refund = AccountRecord.fromHistoryRow({
      'id': 'refund',
      'occurred_at': '2026-09-22T10:15:00Z',
      'transaction_type_code': 'refund',
      'description': 'Refund: Expense: Café & Bar',
      'account_amount': '25',
      'entry_side': 'debit',
      'currency_code': 'SAR',
      'local_date': '2026-09-22',
      'daily_net': '25',
    })!;
    expect(
      accountRecordCategoryLabel(refund, const [], categoriesResolved: false),
      'Café & Bar',
    );
  });

  test('ordinary Expense and Income labels remain unchanged', () {
    AccountRecord row(String type, String description) =>
        AccountRecord.fromHistoryRow({
          'id': type,
          'occurred_at': '2026-09-22T10:15:00Z',
          'transaction_type_code': type,
          'description': description,
          'subcategory_id': 'cafe',
          'account_amount': '25',
          'entry_side': 'credit',
          'currency_code': 'SAR',
          'local_date': '2026-09-22',
          'daily_net': '-25',
        })!;

    expect(
      accountRecordCategoryLabel(
        row('expense', 'Expense: Café & Bar'),
        const [],
        categoriesResolved: false,
      ),
      'Café & Bar',
    );
    expect(
      accountRecordCategoryLabel(
        row('income', 'Income: Salary'),
        const [],
        categoriesResolved: false,
      ),
      'Salary',
    );
    expect(
      accountRecordCategoryLabel(
        row('transfer', 'Transfer'),
        const [],
        categoriesResolved: false,
      ),
      isNull,
    );
  });
  test('Refund summary retains partial/full remaining values', () {
    final partial = ExpenseRefundSummary.fromRow({
      'original_amount': '100',
      'effective_refunded_amount': '25',
      'remaining_refundable_amount': '75',
      'currency_code': 'USD',
    });
    final full = ExpenseRefundSummary.fromRow({
      'original_amount': '100',
      'effective_refunded_amount': '100',
      'remaining_refundable_amount': '0',
      'currency_code': 'USD',
    });
    expect(partial.remainingAmount, '75');
    expect(full.remainingAmount, '0');
  });

  test(
    'unchanged expense form is not dirty after decimal display normalization',
    () {
      final initial = AccountRecordFormValues(
        type: AccountRecordType.expense,
        accountId: 'account',
        amount: '100.0000000000',
        mainCategoryId: 'food',
        subcategoryId: 'cafe',
        occurredAt: '2026-09-19T10:30:00Z',
        notes: 'Lunch',
      );
      final current = initial.copy();
      current.occurredAt = formatLocalDateTimeInput(
        DateTime.parse(initial.occurredAt),
      );

      expect(
        isAccountRecordFormDirty(
          initial: initial,
          current: current,
          displayedAmount: '100',
          displayedReceivedAmount: '',
          displayedNotes: 'Lunch',
        ),
        isFalse,
      );

      expect(
        isAccountRecordFormDirty(
          initial: initial,
          current: current,
          displayedAmount: '100.01',
          displayedReceivedAmount: '',
          displayedNotes: 'Lunch',
        ),
        isTrue,
      );
    },
  );

  test('refund key is a UUID v4 and stable for identical retries', () {
    final keys = RefundSubmissionKey();
    final first = keys.forPayload('expense\u000040\u0000account');
    expect(
      first,
      matches(
        RegExp(
          r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
        ),
      ),
    );
    expect(keys.forPayload('expense\u000040\u0000account'), first);
    final changed = keys.forPayload('expense\u000041\u0000account');
    expect(changed, isNot(first));
    expect(keys.forPayload('expense\u000040\u0000account'), isNot(first));
  });

  test(
    'refund preview uses exact decimals and historical refunded stays fixed',
    () {
      final summary = ExpenseRefundSummary(
        originalAmount: '100',
        refundedAmount: '20',
        remainingAmount: '80',
        currencyCode: 'SAR',
      );
      expect(remainingAfterRefund(summary.remainingAmount, '40'), '40');
      expect(
        remainingAfterRefund(summary.remainingAmount, '0.0000000001'),
        '79.9999999999',
      );
      expect(remainingAfterRefund(summary.remainingAmount, '80.01'), isNull);
      expect(summary.refundedAmount, '20');
    },
  );

  test('refund amount and UUID error have English and Arabic copy', () {
    final en = AccountsCopy.of(AppLanguage.en);
    final ar = AccountsCopy.of(AppLanguage.ar);
    expect(en.refundAmount, 'Refund amount');
    expect(en.invalidRefundRequest, isNot(contains('uuid')));
    expect(ar.refundAmount, isNot(en.refundAmount));
    expect(ar.invalidRefundRequest, isNot(en.invalidRefundRequest));
  });

  test('only a successful refund result closes the Edit Expense sheet', () {
    expect(shouldCloseEditExpenseAfterRefund(true), isTrue);
    expect(shouldCloseEditExpenseAfterRefund(false), isFalse);
    expect(shouldCloseEditExpenseAfterRefund(null), isFalse);
  });

  test('refund history label and cancellation copy are localized', () {
    final en = AccountsCopy.of(AppLanguage.en);
    final ar = AccountsCopy.of(AppLanguage.ar);

    expect(en.recordTypeValue('refund'), 'Refund');
    expect(ar.recordTypeValue('refund'), 'استرداد');
    expect(en.keepRefund, 'Keep refund');
    expect(
      en.cancelRefundBody('40.00 SAR', 'Cash'),
      'Are you sure you want to cancel this 40.00 SAR refund?\n'
      '40.00 SAR will be deducted from Cash, and the refund will disappear '
      'from your transaction history.',
    );
    expect(
      ar.cancelRefundBody(ar.ltr('40.00 SAR'), 'Cash'),
      contains('سيتم خصم'),
    );
    expect(ar.cancelRefundBody(ar.ltr('40.00 SAR'), 'Cash'), contains('Cash'));
  });

  test('authoritative ledger balance replaces stale account-list value', () {
    expect(
      accountRecordsHeaderBalance(
        fallback: '9740',
        authoritative: '9700',
        hasAuthoritativeBalance: true,
      ),
      '9700',
    );
    expect(
      accountRecordsHeaderBalance(
        fallback: '9740',
        authoritative: null,
        hasAuthoritativeBalance: true,
      ),
      isNull,
    );
  });
}
