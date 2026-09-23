import '../../core/decimals.dart';
import '../../core/idempotency_key.dart';

/// A UUID v4 accepted by the refund RPC's uuid parameter.
String newRefundIdempotencyKey() => newIdempotencyKey();

/// Reuse the key only when a retry sends the same refund payload.
class RefundSubmissionKey extends PayloadIdempotencyKey {}

String? remainingAfterRefund(String remaining, String amount) {
  if (!D.isPositive(amount) || (D.compare(amount, remaining) ?? 1) > 0) {
    return null;
  }
  return D.subtract(remaining, amount);
}
