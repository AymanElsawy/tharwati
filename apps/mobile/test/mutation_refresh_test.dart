import 'package:flutter_test/flutter_test.dart';

import 'package:tharwati_mobile/core/idempotency_key.dart';
import 'package:tharwati_mobile/core/mutation_refresh.dart';
import 'package:tharwati_mobile/accounts/valued/disposal_submission.dart';

void main() {
  test('mutation rejection and commitment remain distinct outcomes', () async {
    final committed = await runMutation(
      () async {},
      errorMessage: (_) => 'failed',
    );
    final rejected = await runMutation(
      () async => throw StateError('no'),
      errorMessage: (_) => 'safe error',
    );

    expect(committed, isA<MutationCommitted>());
    expect(rejected, isA<MutationRejected>());
    expect((rejected as MutationRejected).message, 'safe error');
  });

  test('payload keys are valid UUIDs, stable until payload changes', () {
    final attempt = PayloadIdempotencyKey();
    final first = attempt.forPayload('same');
    final unchanged = attempt.forPayload('same');
    final changed = attempt.forPayload('changed');

    expect(
      first,
      matches(
        RegExp(
          r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
        ),
      ),
    );
    expect(unchanged, first);
    expect(changed, isNot(first));
  });

  test('disposal key reuses normalized payload and rotates after a change', () {
    final attempt = DisposalSubmissionKey();
    String key(String amount) => attempt.forPayload(
      accountId: 'property',
      disposedOn: '2026-09-22',
      saleAmount: amount,
      currencyCode: 'USD',
      ownershipPercentageSold: '100.00',
      destinationAccountId: 'cash',
      notes: ' sale ',
    );

    final first = key('10.00');
    expect(key('10.0'), first);
    expect(key('11'), isNot(first));
  });
}
