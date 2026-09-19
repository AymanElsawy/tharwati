import 'package:flutter_test/flutter_test.dart';
import '../lib/core/local_datetime.dart';
import '../lib/accounts/records/record_form_sheet.dart';
import '../lib/accounts/records/account_records_page.dart';
import '../lib/accounts/records/records_models.dart';
import '../lib/accounts/records/refund_submission.dart';
import '../lib/i18n/accounts_copy.dart';
import '../lib/i18n/app_language.dart';

void main() {
  test('Refund maps as a distinct positive non-editable record', () {
    final row = AccountRecord.fromHistoryRow({'id':'r','occurred_at':'2026-01-01T00:00:00Z','transaction_type_code':'refund','description':'Refund','account_amount':'25','entry_side':'debit','currency_code':'USD','local_date':'2026-01-01','daily_net':'25'});
    expect(row!.type, 'refund'); expect(row.amount, '25'); expect(row.isEditable, isFalse);
  });
  test('Refund summary retains partial/full remaining values', () {
    final partial = ExpenseRefundSummary.fromRow({'original_amount':'100','effective_refunded_amount':'25','remaining_refundable_amount':'75','currency_code':'USD'});
    final full = ExpenseRefundSummary.fromRow({'original_amount':'100','effective_refunded_amount':'100','remaining_refundable_amount':'0','currency_code':'USD'});
    expect(partial.remainingAmount, '75'); expect(full.remainingAmount, '0');
  });

  test('unchanged expense form is not dirty after decimal display normalization', () {
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
  });

  test('refund key is a UUID v4 and stable for identical retries', () {
    final keys = RefundSubmissionKey();
    final first = keys.forPayload('expense\u000040\u0000account');
    expect(first, matches(RegExp(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')));
    expect(keys.forPayload('expense\u000040\u0000account'), first);
    expect(keys.forPayload('expense\u000041\u0000account'), isNot(first));
    expect(keys.forPayload('expense\u000040\u0000account'), first);
  });

  test('refund preview uses exact decimals and historical refunded stays fixed', () {
    final summary = ExpenseRefundSummary(
      originalAmount: '100', refundedAmount: '20',
      remainingAmount: '80', currencyCode: 'SAR',
    );
    expect(remainingAfterRefund(summary.remainingAmount, '40'), '40');
    expect(remainingAfterRefund(summary.remainingAmount, '0.0000000001'), '79.9999999999');
    expect(remainingAfterRefund(summary.remainingAmount, '80.01'), isNull);
    expect(summary.refundedAmount, '20');
  });

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
    expect(
      ar.cancelRefundBody(ar.ltr('40.00 SAR'), 'Cash'),
      contains('Cash'),
    );
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
