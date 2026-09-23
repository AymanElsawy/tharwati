import '../../core/decimals.dart';
import '../../core/idempotency_key.dart';

class DisposalSubmissionKey {
  final PayloadIdempotencyKey _attempt = PayloadIdempotencyKey();

  String forPayload({
    required String accountId,
    required String disposedOn,
    required String saleAmount,
    required String currencyCode,
    required String ownershipPercentageSold,
    required String? destinationAccountId,
    required String? notes,
  }) {
    final payload = [
      accountId,
      disposedOn,
      D.normalize(saleAmount) ?? saleAmount.trim(),
      currencyCode,
      D.normalize(ownershipPercentageSold) ?? ownershipPercentageSold.trim(),
      destinationAccountId ?? '',
      notes?.trim() ?? '',
    ].join('\u0000');
    return _attempt.forPayload(payload);
  }
}
