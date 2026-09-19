import 'dart:math';

import '../../core/decimals.dart';

/// A UUID v4 accepted by the refund RPC's uuid parameter.
String newRefundIdempotencyKey() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes.map((byte) => byte.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
      '${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}

/// Reuse the key only when a retry sends the same refund payload.
class RefundSubmissionKey {
  final Map<String, String> _keysByPayload = {};

  String forPayload(String payload) =>
      _keysByPayload.putIfAbsent(payload, newRefundIdempotencyKey);
}

String? remainingAfterRefund(String remaining, String amount) {
  if (!D.isPositive(amount) || (D.compare(amount, remaining) ?? 1) > 0) {
    return null;
  }
  return D.subtract(remaining, amount);
}
