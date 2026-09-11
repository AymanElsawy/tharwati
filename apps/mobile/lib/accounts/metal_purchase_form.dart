// Add-metal-purchase form value shape + validation — port of the web
// `MetalPurchaseFormValues` and its schema (docs/accounts.md §2.6, §3).
//
// Note: the web hardcodes fees to "0" (§9.7). Mobile exposes an optional fees
// field — the RPC and schema have supported it all along; adding the input is
// net-new, not a parity break.

import '../core/decimals.dart';
import 'account_form.dart';

final _grams = RegExp(r'^\d{1,18}(?:\.\d{1,3})?$');
final _amount = RegExp(r'^\d{1,18}(?:\.\d{1,2})?$');

class MetalPurchaseFormValues {
  MetalPurchaseFormValues({
    this.purity = '',
    String? purchaseDate,
    this.unitsGrams = '',
    this.costPerUnit = '',
    this.fees = '',
    this.paidFromAccount = false,
    this.fundingAccountId = '',
    this.notes = '',
  }) : purchaseDate = purchaseDate ?? DateTime.now().toIso8601String();

  String purity;
  String purchaseDate; // ISO local timestamp; converted to UTC on submit
  String unitsGrams;
  String costPerUnit;
  String fees;
  bool paidFromAccount;
  String fundingAccountId;
  String notes;

  /// `subtotal = unitsGrams * costPerUnit`
  String? get subtotal => D.multiply(
    unitsGrams.trim().isEmpty ? '0' : unitsGrams.trim(),
    costPerUnit.trim().isEmpty ? '0' : costPerUnit.trim(),
  );

  /// `total cost / cost basis = subtotal + fees`
  String? get totalCost {
    final sub = subtotal;
    if (sub == null) return null;
    return D.add(sub, fees.trim().isEmpty ? '0' : fees.trim());
  }
}

const _msg = {
  'purityRequired': 'Choose a purity for this metal.',
  'dateRequired': 'Enter the purchase date and time.',
  'gramsInvalid': 'Grams must be a positive number (up to 3 decimals).',
  'costInvalid': 'Cost per gram must be greater than zero.',
  'feesInvalid': 'Fees must be zero or more.',
  'fundingRequired': 'Choose the account you paid from.',
};

Map<String, String> validateMetalPurchase(
  MetalPurchaseFormValues v, {
  required String metalType,
}) {
  final errors = <String, String>{};
  final purities = purityOptionsFor(metalType);

  if (v.purity.isEmpty || !purities.contains(v.purity)) {
    errors['purity'] = _msg['purityRequired']!;
  }
  if (DateTime.tryParse(v.purchaseDate) == null) {
    errors['purchaseDate'] = _msg['dateRequired']!;
  }
  final grams = v.unitsGrams.trim();
  if (!_grams.hasMatch(grams) || (D.compare(grams, '0') ?? -1) <= 0) {
    errors['unitsGrams'] = _msg['gramsInvalid']!;
  }
  final cost = v.costPerUnit.trim();
  if (!_amount.hasMatch(cost) || (D.compare(cost, '0') ?? -1) <= 0) {
    errors['costPerUnit'] = _msg['costInvalid']!;
  }
  final fees = v.fees.trim();
  if (fees.isNotEmpty &&
      (!_amount.hasMatch(fees) || (D.compare(fees, '0') ?? -1) < 0)) {
    errors['fees'] = _msg['feesInvalid']!;
  }
  if (v.paidFromAccount && v.fundingAccountId.isEmpty) {
    errors['fundingAccountId'] = _msg['fundingRequired']!;
  }
  return errors;
}
