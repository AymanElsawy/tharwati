// Account-record form validation — 1:1 port of the web Zod
// `createAccountRecordSchema` (account-record.schema.ts). Messages match the
// web i18n `accounts.records.validation.*` strings verbatim.

import 'records_models.dart';

final _positiveAmount = RegExp(r'^\d{1,18}(?:\.\d{1,2})?$');

const _msg = {
  'account': 'Select an account.',
  'amount': 'Enter a positive amount with up to 2 decimal places.',
  'date': 'Date and time are required.',
  'category': 'Category is required.',
  'differentAccounts': 'From and to accounts must be different.',
};

bool _isPositive(String v) =>
    _positiveAmount.hasMatch(v) && (double.tryParse(v) ?? 0) > 0;

Map<String, String> validateAccountRecordForm(AccountRecordFormValues v) {
  final errors = <String, String>{};

  if (v.accountId.trim().isEmpty) errors['accountId'] = _msg['account']!;
  if (!_isPositive(v.amount.trim())) errors['amount'] = _msg['amount']!;
  if (v.occurredAt.trim().isEmpty) errors['occurredAt'] = _msg['date']!;

  if (v.type == AccountRecordType.transfer) {
    if (v.toAccountId.isEmpty) {
      errors['toAccountId'] = _msg['account']!;
    } else if (v.accountId == v.toAccountId) {
      errors['toAccountId'] = _msg['differentAccounts']!;
    }
    if (!_isPositive(v.receivedAmount.trim())) {
      errors['receivedAmount'] = _msg['amount']!;
    }
  } else if (v.mainCategoryId.isEmpty || v.subcategoryId.isEmpty) {
    errors['subcategoryId'] = _msg['category']!;
  }

  return errors;
}
