import 'package:flutter_test/flutter_test.dart';

import 'package:tharwati_mobile/accounts/records/record_submission.dart';
import 'package:tharwati_mobile/accounts/records/records_models.dart';
import 'package:tharwati_mobile/core/idempotency_key.dart';

AccountRecordFormValues values({String amount = '10.00'}) =>
    AccountRecordFormValues(
      type: AccountRecordType.income,
      accountId: 'account',
      toAccountId: '',
      amount: amount,
      receivedAmount: '',
      mainCategoryId: 'main',
      subcategoryId: 'sub',
      occurredAt: '2026-09-23T10:30',
      notes: ' note ',
    );

void main() {
  test('unchanged normalized record payload reuses its idempotency key', () {
    final attempt = PayloadIdempotencyKey();
    final first = attempt.forPayload(
      accountRecordSubmissionFingerprint(values()),
    );
    final unchanged = attempt.forPayload(
      accountRecordSubmissionFingerprint(values(amount: '10.0')),
    );
    final changed = attempt.forPayload(
      accountRecordSubmissionFingerprint(values(amount: '11')),
    );

    expect(unchanged, first);
    expect(changed, isNot(first));
  });
}
