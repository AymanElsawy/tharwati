import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/accounts/brokerage/brokerage_models.dart';
import 'package:tharwati_mobile/accounts/brokerage/brokerage_submission.dart';
import 'package:tharwati_mobile/accounts/brokerage/brokerage_valuation.dart';
import 'package:tharwati_mobile/core/idempotency_key.dart';

void main() {
  test('trade key follows normalized payload and side', () {
    final attempt = PayloadIdempotencyKey();
    final value = TradeFormValues(
      side: TradeSide.buy,
      assetId: 'asset',
      quantity: '1.00',
      unitPrice: '10.0',
      fees: '0',
      occurredAt: '2026-09-24T10:00',
    );
    final first = attempt.forPayload(
      brokerageTradeFingerprint('account', value),
    );
    value.quantity = '1';
    value.fees = '';
    expect(
      attempt.forPayload(brokerageTradeFingerprint('account', value)),
      first,
    );
    value.side = TradeSide.sell;
    expect(
      attempt.forPayload(brokerageTradeFingerprint('account', value)),
      isNot(first),
    );
  });
  test('dividend mode rotates key and cash ignores reinvestment fields', () {
    final attempt = PayloadIdempotencyKey();
    String fp(DividendMode mode, {String? price}) =>
        brokerageDividendFingerprint(
          accountId: 'a',
          assetId: 's',
          mode: mode,
          gross: '10',
          tax: '0',
          fees: '0',
          occurredAt: '2026-09-24T10:00',
          unitPrice: price,
          reinvestedAmount: '4',
        );
    final first = attempt.forPayload(fp(DividendMode.cash, price: '5'));
    expect(attempt.forPayload(fp(DividendMode.cash, price: '9')), first);
    expect(attempt.forPayload(fp(DividendMode.full, price: '9')), isNot(first));
  });
}
