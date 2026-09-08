/// The `financial_accounts` fields the dashboard aggregate needs. Money columns
/// arrive as decimal strings (selected with `::text`).
class AccountSummary {
  const AccountSummary({
    required this.id,
    required this.accountTypeCode,
    required this.name,
    required this.currencyCode,
    required this.openingBalance,
    required this.isActive,
    this.bankSubtype,
    this.creditCardLimit,
    this.metalType,
  });

  final String id;
  final String
  accountTypeCode; // cash | bank | brokerage | gold | real_estate | business | other
  final String name;
  final String currencyCode;
  final String openingBalance;
  final bool isActive;
  final String? bankSubtype; // 'debit' | 'credit' | null
  final String? creditCardLimit; // decimal string, credit cards only
  final String? metalType; // 'gold' | 'silver' | null

  factory AccountSummary.fromRow(Map<String, dynamic> row) {
    return AccountSummary(
      id: row['id'] as String,
      accountTypeCode: row['account_type_code'] as String,
      name: (row['name'] as String?) ?? '',
      currencyCode: row['currency_code'] as String,
      openingBalance: (row['opening_balance'] as String?) ?? '0',
      isActive: row['is_active'] as bool? ?? false,
      bankSubtype: row['bank_subtype'] as String?,
      creditCardLimit: row['credit_card_limit'] as String?,
      metalType: row['metal_type'] as String?,
    );
  }
}
