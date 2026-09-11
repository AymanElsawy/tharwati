// Account form validation — 1:1 port of the web Zod `createAccountSchema`
// superRefine (src/features/accounts/schemas/account.schema.ts, docs/accounts.md §3).
// Returns a field -> message map; empty means valid. Errors surface only after
// the first submit attempt (the form gates on that, not this function).

import '../core/decimals.dart';
import 'account_form.dart';
import 'account_models.dart';

final _decimalAmount = RegExp(r'^\d{1,18}(?:\.\d{1,2})?$');
final _percentage = RegExp(r'^\d{1,3}(?:\.\d{1,2})?$');
final _isoDate = RegExp(r'^\d{4}-\d{2}-\d{2}$');
final _dueDay = RegExp(r'^(?:[1-9]|[12]\d|3[01])$');

// Messages are 1:1 with the web i18n `accounts.validation.*` strings.
const _msg = {
  'nameRequired': 'Name is required',
  'balanceRequired': 'Balance is required',
  'balanceInvalid': 'Enter a non-negative amount with up to 2 decimal places',
  'bankSubtypeRequired': 'Select debit or credit',
  'creditCardLimitInvalid':
      'Enter a positive credit card limit with up to 2 decimal places',
  'dueDayOfMonthInvalid': 'Select a due day from 1 through 31',
  'creditBalanceExceedsLimit':
      'Current balance cannot exceed the credit card limit',
  'investmentTypeRequired': 'Select a type of investment',
  'metalTypeRequired': 'Select gold or silver',
  'ownershipRequired': 'Ownership percentage is required',
  'ownershipInvalid': 'Enter a value between 0 and 100',
  'propertyTypeRequired': 'Select a property type',
  'businessTypeRequired': 'Business type is required',
  'businessTypeOtherRequired': 'Specify the business type',
  'industryRequired': 'Industry is required',
  'industryOtherRequired': 'Specify the industry',
  'valuationDateRequired': 'Valuation date is required',
  'valuationDateFuture': 'Valuation date cannot be in the future',
};

Map<String, String> validateAccountForm(
  AccountFormValues v, {
  required bool isCreate,
}) {
  final errors = <String, String>{};

  void requireBalance() {
    if (v.openingBalance.trim().isEmpty) {
      errors['openingBalance'] = _msg['balanceRequired']!;
    } else if (!_decimalAmount.hasMatch(v.openingBalance.trim())) {
      errors['openingBalance'] = _msg['balanceInvalid']!;
    }
  }

  void requirePercentage() {
    final p = v.ownershipPercentage.trim();
    if (p.isEmpty) {
      errors['ownershipPercentage'] = _msg['ownershipRequired']!;
      return;
    }
    if (!_percentage.hasMatch(p) || (double.tryParse(p) ?? 101) > 100) {
      errors['ownershipPercentage'] = _msg['ownershipInvalid']!;
    }
  }

  void validateValuationDate() {
    final d = v.valuationDate.trim();
    if (!_isoDate.hasMatch(d)) {
      errors['valuationDate'] = _msg['valuationDateRequired']!;
      return;
    }
    if (d.compareTo(DateTime.now().toIso8601String().substring(0, 10)) > 0) {
      errors['valuationDate'] = _msg['valuationDateFuture']!;
    }
  }

  if (v.type != AccountType.gold && v.name.trim().isEmpty) {
    errors['name'] = _msg['nameRequired']!;
  }

  switch (v.type) {
    case AccountType.cash:
    case AccountType.other:
      requireBalance();
    case AccountType.bank:
      requireBalance();
      if (v.bankSubtype.isEmpty) {
        errors['bankSubtype'] = _msg['bankSubtypeRequired']!;
      }
      if (v.bankSubtype == 'credit') {
        final limit = v.creditCardLimit.trim();
        if (!_decimalAmount.hasMatch(limit) ||
            (D.compare(limit, '0') ?? -1) <= 0) {
          errors['creditCardLimit'] = _msg['creditCardLimitInvalid']!;
        }
        if (v.dueDayOfMonth.isNotEmpty &&
            !_dueDay.hasMatch(v.dueDayOfMonth.trim())) {
          errors['dueDayOfMonth'] = _msg['dueDayOfMonthInvalid']!;
        }
        if (_decimalAmount.hasMatch(v.openingBalance.trim()) &&
            _decimalAmount.hasMatch(limit) &&
            (D.compare(v.openingBalance.trim(), limit) ?? 0) > 0) {
          errors['openingBalance'] = _msg['creditBalanceExceedsLimit']!;
        }
      }
    case AccountType.brokerage:
      requireBalance();
      if (v.investmentType.isEmpty) {
        errors['investmentType'] = _msg['investmentTypeRequired']!;
      }
    case AccountType.gold:
      if (v.metalType.isEmpty) {
        errors['metalType'] = _msg['metalTypeRequired']!;
      }
    case AccountType.realEstate:
      if (isCreate) requireBalance();
      requirePercentage();
      if (v.propertyType.isEmpty) {
        errors['propertyType'] = _msg['propertyTypeRequired']!;
      }
      if (isCreate) validateValuationDate();
    case AccountType.business:
      if (isCreate) requireBalance();
      requirePercentage();
      if (v.businessType.isEmpty) {
        errors['businessType'] = _msg['businessTypeRequired']!;
      }
      if (v.businessType == 'other' && v.businessTypeOther.trim().isEmpty) {
        errors['businessTypeOther'] = _msg['businessTypeOtherRequired']!;
      }
      if (v.industry.isEmpty) {
        errors['industry'] = _msg['industryRequired']!;
      }
      if (v.industry == 'other' && v.industryOther.trim().isEmpty) {
        errors['industryOther'] = _msg['industryOtherRequired']!;
      }
      // `valuationMethod` is a free-text field (web parity) — no validation.
      if (isCreate) validateValuationDate();
  }

  return errors;
}
