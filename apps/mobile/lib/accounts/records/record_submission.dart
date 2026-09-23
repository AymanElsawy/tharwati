import 'dart:convert';

import '../../core/decimals.dart';
import '../../core/local_datetime.dart';
import 'records_models.dart';

String accountRecordSubmissionFingerprint(AccountRecordFormValues values) {
  final isTransfer = values.type == AccountRecordType.transfer;
  return jsonEncode([
    values.type.code,
    values.accountId,
    isTransfer ? values.toAccountId : null,
    D.normalize(values.amount),
    isTransfer ? D.normalize(values.receivedAmount) : null,
    localDateTimeInputToIso(values.occurredAt),
    isTransfer ? null : values.mainCategoryId,
    isTransfer ? null : values.subcategoryId,
    values.notes.trim().isEmpty ? null : values.notes.trim(),
  ]);
}
