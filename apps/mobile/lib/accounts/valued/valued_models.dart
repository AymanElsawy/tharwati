// Real Estate / Business detail models — port of account-valuation.ts +
// account-disposal.ts.

class AccountValuationEntry {
  const AccountValuationEntry({
    required this.id,
    required this.accountId,
    required this.valuationAmount,
    required this.valuedOn,
    required this.valuationMethod,
    required this.notes,
    required this.correctsValuationId,
    required this.createdAt,
  });

  final String id;
  final String accountId;
  final String valuationAmount; // decimal string, full (100%) value
  final String valuedOn; // yyyy-MM-dd
  final String? valuationMethod;
  final String? notes;
  final String? correctsValuationId;
  final String createdAt;

  factory AccountValuationEntry.fromRow(Map<String, dynamic> row) =>
      AccountValuationEntry(
        id: '${row['id']}',
        accountId: '${row['account_id']}',
        valuationAmount: '${row['valuation_amount'] ?? '0'}',
        valuedOn: '${row['valued_on']}',
        valuationMethod: row['valuation_method'] as String?,
        notes: row['notes'] as String?,
        correctsValuationId: row['corrects_valuation_id'] as String?,
        createdAt: '${row['created_at']}',
      );
}

class AccountValuationInput {
  const AccountValuationInput({
    required this.valuationAmount,
    required this.valuedOn,
    this.valuationMethod,
    this.notes,
  });
  final String valuationAmount;
  final String valuedOn;
  final String? valuationMethod;
  final String? notes;
}

class AccountDisposal {
  const AccountDisposal({
    required this.id,
    required this.accountId,
    required this.disposedOn,
    required this.saleAmount,
    required this.saleCurrencyCode,
    required this.ownershipPercentageSold,
    required this.notes,
    required this.isEffective,
  });

  final String id;
  final String accountId;
  final String disposedOn;
  final String saleAmount;
  final String saleCurrencyCode;
  final String ownershipPercentageSold;
  final String? notes;
  final bool isEffective;

  factory AccountDisposal.fromRow(Map<String, dynamic> row) => AccountDisposal(
    id: '${row['id']}',
    accountId: '${row['account_id']}',
    disposedOn: '${row['disposed_on']}',
    saleAmount: '${row['sale_amount'] ?? '0'}',
    saleCurrencyCode: '${row['sale_currency_code']}',
    ownershipPercentageSold: '${row['ownership_percentage_sold'] ?? '0'}',
    notes: row['notes'] as String?,
    isEffective: row['is_effective'] as bool? ?? true,
  );
}

class AccountOwnershipProjection {
  const AccountOwnershipProjection({
    required this.accountId,
    required this.ownershipPercentage,
    required this.isSold,
  });
  final String accountId;
  final String? ownershipPercentage;
  final bool isSold;

  factory AccountOwnershipProjection.fromRow(Map<String, dynamic> row) =>
      AccountOwnershipProjection(
        accountId: '${row['account_id']}',
        ownershipPercentage: row['ownership_percentage'] == null
            ? null
            : '${row['ownership_percentage']}',
        isSold: row['is_sold'] as bool? ?? false,
      );
}

class AddAccountDisposalInput {
  const AddAccountDisposalInput({
    required this.disposedOn,
    required this.saleAmount,
    required this.saleCurrencyCode,
    required this.ownershipPercentageSold,
    required this.idempotencyKey,
    this.destinationAccountId,
    this.notes,
  });
  final String disposedOn;
  final String saleAmount;
  final String saleCurrencyCode;
  final String ownershipPercentageSold;
  final String idempotencyKey;
  final String? destinationAccountId;
  final String? notes;
}
