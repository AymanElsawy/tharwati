// Accounts data model — port of the web `AccountSummary` shape
// (docs/accounts.md §2.4). All monetary / quantity columns arrive as decimal
// strings (`::text` casts) and stay strings end to end; see lib/core/decimals.dart.

import 'package:flutter/material.dart';

/// The 7 polymorphic account types (`account_types` seed / hardcoded client-side).
enum AccountType {
  cash,
  bank,
  brokerage,
  gold,
  realEstate,
  business,
  other;

  String get code => switch (this) {
    AccountType.cash => 'cash',
    AccountType.bank => 'bank',
    AccountType.brokerage => 'brokerage',
    AccountType.gold => 'gold',
    AccountType.realEstate => 'real_estate',
    AccountType.business => 'business',
    AccountType.other => 'other',
  };

  static AccountType fromCode(String code) => switch (code) {
    'cash' => AccountType.cash,
    'bank' => AccountType.bank,
    'brokerage' => AccountType.brokerage,
    'gold' => AccountType.gold,
    'real_estate' => AccountType.realEstate,
    'business' => AccountType.business,
    _ => AccountType.other,
  };

  /// Plain label. Gold/Bank get a subtype-aware label via [accountTypeLabel].
  String get label => switch (this) {
    AccountType.cash => 'Cash',
    AccountType.bank => 'Bank',
    AccountType.brokerage => 'Brokerage',
    AccountType.gold => 'Gold & silver',
    AccountType.realEstate => 'Real estate',
    AccountType.business => 'Business',
    AccountType.other => 'Other',
  };

  /// Short label for the type-picker grid (canvas screen 13).
  String get shortLabel => switch (this) {
    AccountType.brokerage => 'Broker',
    AccountType.gold => 'Metals',
    AccountType.realEstate => 'Property',
    _ => label,
  };

  IconData get icon => switch (this) {
    AccountType.cash => Icons.payments_outlined,
    AccountType.bank => Icons.account_balance_outlined,
    AccountType.brokerage => Icons.show_chart,
    AccountType.gold => Icons.diamond_outlined,
    AccountType.realEstate => Icons.home_outlined,
    AccountType.business => Icons.storefront_outlined,
    AccountType.other => Icons.category_outlined,
  };

  bool get isMetal => this == AccountType.gold;

  /// Real Estate / Business carry their value in `account_valuations`, not
  /// `opening_balance` (docs/accounts.md §2.1, §2.5).
  bool get isValued =>
      this == AccountType.realEstate || this == AccountType.business;
}

const kAccountCurrencies = ['USD', 'SAR', 'EGP', 'EUR', 'GBP'];

/// The full `financial_accounts` row the Accounts tab needs.
class Account {
  const Account({
    required this.id,
    required this.type,
    required this.name,
    required this.currencyCode,
    required this.openingBalance,
    required this.isActive,
    required this.notes,
    required this.bankSubtype,
    required this.creditCardLimit,
    required this.dueDayOfMonth,
    required this.investmentType,
    required this.balanceGrams,
    required this.propertyType,
    required this.ownershipPercentage,
    required this.businessType,
    required this.industry,
    required this.location,
    required this.metalType,
    required this.purity,
    required this.purchaseDate,
    required this.costPerUnit,
    required this.closedReason,
    required this.closedOn,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final AccountType type;
  final String name;
  final String currencyCode;
  final String openingBalance; // decimal string
  final bool isActive;
  final String? notes;
  final String? bankSubtype; // 'debit' | 'credit'
  final String? creditCardLimit; // decimal string
  final int? dueDayOfMonth;
  final String? investmentType; // 'stock_etf' | 'crypto' | 'other'
  final String? balanceGrams; // decimal string
  final String? propertyType;
  final String? ownershipPercentage; // decimal string, server-derived remaining
  final String? businessType; // code, or 'other:<text>'
  final String? industry; // code, or 'other:<text>'
  final String? location;
  final String? metalType; // 'gold' | 'silver'
  final String? purity;
  final String? purchaseDate; // 'YYYY-MM-DD'
  final String? costPerUnit; // decimal string, weighted-avg cost per gram
  final String? closedReason; // 'sold' is distinct from ordinary close
  final String? closedOn;
  final String createdAt;
  final String updatedAt;

  bool get isSold => closedReason == 'sold';
  bool get isClosed => !isActive && !isSold;
  bool get isBankCredit => type == AccountType.bank && bankSubtype == 'credit';

  /// Row label: Bank shows the subtype, Gold shows the metal.
  String get typeLabel {
    if (type == AccountType.bank && bankSubtype != null) {
      return bankSubtype == 'credit' ? 'Bank Credit' : 'Bank Debit';
    }
    if (type == AccountType.gold && metalType != null) {
      return metalType == 'silver' ? 'Silver' : 'Gold';
    }
    return type.label;
  }

  factory Account.fromRow(Map<String, dynamic> row) {
    String? s(String k) => row[k] == null ? null : '${row[k]}';
    return Account(
      id: row['id'] as String,
      type: AccountType.fromCode('${row['account_type_code']}'),
      name: (row['name'] as String?) ?? '',
      currencyCode: '${row['currency_code']}',
      openingBalance: s('opening_balance') ?? '0',
      isActive: row['is_active'] as bool? ?? true,
      notes: row['notes'] as String?,
      bankSubtype: row['bank_subtype'] as String?,
      creditCardLimit: s('credit_card_limit'),
      dueDayOfMonth: row['due_day_of_month'] == null
          ? null
          : int.tryParse('${row['due_day_of_month']}'),
      investmentType: row['investment_type'] as String?,
      balanceGrams: s('balance_grams'),
      propertyType: row['property_type'] as String?,
      ownershipPercentage: s('ownership_percentage'),
      businessType: row['business_type'] as String?,
      industry: row['industry'] as String?,
      location: row['location'] as String?,
      metalType: row['metal_type'] as String?,
      purity: row['purity'] as String?,
      purchaseDate: row['purchase_date'] as String?,
      costPerUnit: s('cost_per_unit'),
      closedReason: row['closed_reason'] as String?,
      closedOn: row['closed_on'] as String?,
      createdAt: '${row['created_at']}',
      updatedAt: '${row['updated_at'] ?? row['created_at']}',
    );
  }
}

/// One immutable `metal_purchases` row (effective set only — reversed /
/// corrected purchases are filtered by `get_effective_metal_purchases`).
class MetalPurchase {
  const MetalPurchase({
    required this.id,
    required this.accountId,
    required this.purity,
    required this.purchasedAt,
    required this.quantityGrams,
    required this.costPerUnit,
    required this.fees,
    required this.fundingMode,
    required this.fundingAccountId,
    required this.notes,
    required this.createdAt,
  });

  final String id;
  final String accountId;
  final String purity;
  final String purchasedAt; // ISO timestamp
  final String quantityGrams; // decimal string
  final String costPerUnit; // decimal string
  final String fees; // decimal string
  final String fundingMode; // 'external' | 'cash_account'
  final String? fundingAccountId;
  final String? notes;
  final String createdAt;

  factory MetalPurchase.fromRow(Map<String, dynamic> row) => MetalPurchase(
    id: row['id'] as String,
    accountId: '${row['account_id']}',
    purity: '${row['purity']}',
    purchasedAt: '${row['purchased_at']}',
    quantityGrams: '${row['quantity_grams'] ?? '0'}',
    costPerUnit: '${row['cost_per_unit'] ?? '0'}',
    fees: '${row['fees'] ?? '0'}',
    fundingMode: '${row['funding_mode']}',
    fundingAccountId: row['funding_account_id'] as String?,
    notes: row['notes'] as String?,
    createdAt: '${row['created_at']}',
  );
}

/// Server-authoritative Close / Delete eligibility (`get_account_lifecycle_eligibility`).
class AccountLifecycle {
  const AccountLifecycle({
    required this.accountId,
    required this.canClose,
    required this.closeBlockReason,
    required this.canDelete,
    required this.deleteBlockReason,
    required this.hasFinancialHistory,
  });

  final String accountId;
  final bool canClose;
  final String? closeBlockReason;
  final bool canDelete;
  final String? deleteBlockReason;
  final bool hasFinancialHistory;

  factory AccountLifecycle.fromRow(Map<String, dynamic> row) =>
      AccountLifecycle(
        accountId: '${row['account_id']}',
        canClose: row['can_close'] as bool? ?? false,
        closeBlockReason: row['close_block_reason'] as String?,
        canDelete: row['can_delete'] as bool? ?? false,
        deleteBlockReason: row['delete_block_reason'] as String?,
        hasFinancialHistory: row['has_financial_history'] as bool? ?? false,
      );
}

/// One `get_account_balances` projection row (ledger-adjusted current balance
/// for Cash / Bank / active Brokerage).
class AccountBalance {
  const AccountBalance({
    required this.accountId,
    required this.openingBalance,
    required this.ledgerEffect,
    required this.currentBalance,
  });

  final String accountId;
  final String openingBalance;
  final String ledgerEffect;
  final String currentBalance;

  factory AccountBalance.fromRow(Map<String, dynamic> row) => AccountBalance(
    accountId: '${row['account_id']}',
    openingBalance: '${row['opening_balance'] ?? '0'}',
    ledgerEffect: '${row['ledger_effect'] ?? '0'}',
    currentBalance: '${row['current_balance'] ?? '0'}',
  );
}

/// One effective `account_valuations` row (latest per account = current full
/// valuation; multiply by ownership for attributable value).
class AccountValuation {
  const AccountValuation({
    required this.accountId,
    required this.amount,
    required this.valuedOn,
    required this.method,
  });

  final String accountId;
  final String amount; // decimal string, full (100%) valuation
  final String valuedOn; // 'YYYY-MM-DD'
  final String? method;

  factory AccountValuation.fromRow(Map<String, dynamic> row) =>
      AccountValuation(
        accountId: '${row['account_id']}',
        amount: '${row['valuation_amount'] ?? '0'}',
        valuedOn: '${row['valued_on']}',
        method: row['valuation_method'] as String?,
      );
}
