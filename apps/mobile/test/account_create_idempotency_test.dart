import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/accounts/create_submission.dart';
import 'package:tharwati_mobile/core/idempotency_key.dart';

void main() {
  final cases = <String, Map<String, dynamic>>{
    'metal': {
      'p_quantity_grams': '2.00',
      'p_cost_per_unit': '10.0',
      'p_purity': '24k',
      'p_notes': 'original',
    },
    'holding': {
      'p_quantity': '2.00',
      'p_average_cost': '10.0',
      'p_account_fx_rate': '3.750',
      'p_notes': 'original',
    },
    'valuation': {
      'p_valuation_amount': '500.00',
      'p_valued_on': '2026-09-01',
      'p_valuation_method': 'other: estimate ',
      'p_notes': 'original',
    },
    'ordinary': {
      'p_opening_balance': '50.00',
      'p_credit_card_limit': '100.0',
      'p_name': 'Bank',
      'p_notes': 'original',
    },
    'valued': {
      'p_valuation_amount': '500.00',
      'p_ownership_percentage': '50.0',
      'p_name': 'Business',
      'p_notes': 'original',
    },
  };
  for (final entry in cases.entries) {
    test(
      '${entry.key} retains unchanged attempt, rotates changed payload, clears only on commit',
      () {
        final attempt = PayloadIdempotencyKey();
        final original = attempt.forPayload(createFingerprint(entry.value));
        final equivalent = entry.value.map(
          (key, value) => MapEntry(
            key,
            value is String && value.endsWith('.00')
                ? value.substring(0, value.length - 3)
                : value,
          ),
        );
        expect(attempt.forPayload(createFingerprint(equivalent)), original);
        final changed = {...entry.value, 'p_notes': 'changed'};
        final next = attempt.forPayload(createFingerprint(changed));
        expect(next, isNot(original));
        expect(attempt.forPayload(createFingerprint(changed)), next);
        attempt.clear();
        expect(attempt.forPayload(createFingerprint(changed)), isNot(next));
      },
    );
  }
  test('method normalization and text preserve financial request identity', () {
    expect(
      createFingerprint({'p_valuation_method': 'other:  estimate  '}),
      createFingerprint({'p_valuation_method': 'other:estimate'}),
    );
    expect(
      createFingerprint({'p_notes': '01'}),
      isNot(createFingerprint({'p_notes': '1'})),
    );
  });
}
