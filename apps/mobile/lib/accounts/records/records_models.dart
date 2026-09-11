// Account-records ledger model — port of the web
// src/features/accounts/types/account-record.ts + record-category.ts. Cash /
// Bank accounts reuse the shared financial_transactions ledger; a "record" is
// one account-scoped entry (income / expense / transfer) with a signed amount.

/// One row of the account record history (`get_account_record_history`).
class AccountRecord {
  const AccountRecord({
    required this.id,
    required this.occurredAt,
    required this.type,
    required this.isEditable,
    required this.description,
    required this.notes,
    required this.mainCategoryId,
    required this.subcategoryId,
    required this.amount,
    required this.currencyCode,
    required this.localDate,
    required this.dailyNet,
  });

  final String id;
  final String occurredAt; // ISO
  final String type; // income | expense | transfer | ...
  final bool isEditable;
  final String description;
  final String? notes;
  final String? mainCategoryId;
  final String? subcategoryId;
  final String amount; // signed decimal string (credit => leading '-')
  final String currencyCode;
  final String localDate; // yyyy-MM-dd in the requested time zone
  final String dailyNet; // server total for that local day

  static AccountRecord? fromHistoryRow(Map<String, dynamic> row) {
    final rawAmount = '${row['account_amount'] ?? ''}';
    if (rawAmount.isEmpty) return null;
    final side = '${row['entry_side']}';
    return AccountRecord(
      id: '${row['id']}',
      occurredAt: '${row['occurred_at']}',
      type: '${row['transaction_type_code']}',
      isEditable:
          const [
            'income',
            'expense',
            'transfer',
          ].contains('${row['transaction_type_code']}') &&
          '${row['description']}' != 'Brokerage cash transfer',
      description: '${row['description'] ?? ''}',
      notes: row['notes'] as String?,
      mainCategoryId: row['main_category_id'] as String?,
      subcategoryId: row['subcategory_id'] as String?,
      amount: side == 'credit' ? '-$rawAmount' : rawAmount,
      currencyCode: '${row['currency_code']}',
      localDate: '${row['local_date']}',
      dailyNet: '${row['daily_net'] ?? '0'}',
    );
  }
}

/// A day bucket in the grouped ledger.
class AccountRecordDateGroup {
  AccountRecordDateGroup({
    required this.date,
    required this.dailyNet,
    required this.currencyCode,
    required this.records,
  });

  final String date;
  final String dailyNet;
  final String currencyCode;
  final List<AccountRecord> records;
}

enum AccountRecordType { expense, income, transfer }

extension AccountRecordTypeX on AccountRecordType {
  String get code => name;
  static AccountRecordType fromCode(String code) => switch (code) {
    'income' => AccountRecordType.income,
    'transfer' => AccountRecordType.transfer,
    _ => AccountRecordType.expense,
  };
}

/// The add / edit record form value shape (`AccountRecordFormValues`).
class AccountRecordFormValues {
  AccountRecordFormValues({
    this.type = AccountRecordType.expense,
    this.accountId = '',
    this.toAccountId = '',
    this.amount = '',
    this.receivedAmount = '',
    this.mainCategoryId = '',
    this.subcategoryId = '',
    this.occurredAt = '',
    this.notes = '',
  });

  AccountRecordType type;
  String accountId;
  String toAccountId;
  String amount;
  String receivedAmount;
  String mainCategoryId;
  String subcategoryId;
  String occurredAt; // yyyy-MM-ddTHH:mm local
  String notes;

  AccountRecordFormValues copy() => AccountRecordFormValues(
    type: type,
    accountId: accountId,
    toAccountId: toAccountId,
    amount: amount,
    receivedAmount: receivedAmount,
    mainCategoryId: mainCategoryId,
    subcategoryId: subcategoryId,
    occurredAt: occurredAt,
    notes: notes,
  );
}

class EditableAccountRecord {
  const EditableAccountRecord({required this.id, required this.values});
  final String id;
  final AccountRecordFormValues values;
}

/// History query filters (`AccountRecordHistoryFilters`).
class AccountRecordHistoryFilters {
  AccountRecordHistoryFilters({
    this.search = '',
    this.fromDate = '',
    this.toDate = '',
    this.recordType,
    this.mainCategoryId = '',
    this.subcategoryId = '',
    this.minAmount = '',
    this.maxAmount = '',
  });

  String search;
  String fromDate;
  String toDate;
  AccountRecordType? recordType;
  String mainCategoryId;
  String subcategoryId;
  String minAmount;
  String maxAmount;

  bool get isEmpty =>
      search.isEmpty &&
      fromDate.isEmpty &&
      toDate.isEmpty &&
      recordType == null &&
      mainCategoryId.isEmpty &&
      subcategoryId.isEmpty &&
      minAmount.isEmpty &&
      maxAmount.isEmpty;

  AccountRecordHistoryFilters copy() => AccountRecordHistoryFilters(
    search: search,
    fromDate: fromDate,
    toDate: toDate,
    recordType: recordType,
    mainCategoryId: mainCategoryId,
    subcategoryId: subcategoryId,
    minAmount: minAmount,
    maxAmount: maxAmount,
  );
}

class AccountRecordHistoryCursor {
  const AccountRecordHistoryCursor({
    required this.occurredAt,
    required this.id,
  });
  final String occurredAt;
  final String id;
}

class AccountRecordHistoryPage {
  const AccountRecordHistoryPage({
    required this.records,
    required this.nextCursor,
    required this.hasMore,
  });
  final List<AccountRecord> records;
  final AccountRecordHistoryCursor? nextCursor;
  final bool hasMore;
}

// ---- record categories ----------------------------------------------------

class RecordCategory {
  const RecordCategory({
    required this.id,
    required this.userId,
    required this.parentId,
    required this.systemCode,
    required this.level, // 'main' | 'subcategory'
    required this.name,
    required this.sortOrder,
    required this.isArchived,
  });

  final String id;
  final String? userId;
  final String? parentId;
  final String? systemCode;
  final String level;
  final String name;
  final int sortOrder;
  final bool isArchived;

  bool get isMain => level == 'main';
  bool get isDefault => userId == null;

  factory RecordCategory.fromRow(Map<String, dynamic> row) => RecordCategory(
    id: '${row['id']}',
    userId: row['user_id'] as String?,
    parentId: row['parent_id'] as String?,
    systemCode: row['system_code'] as String?,
    level: '${row['level']}',
    name: '${row['name']}',
    sortOrder: int.tryParse('${row['sort_order']}') ?? 0,
    isArchived: row['is_archived'] as bool? ?? false,
  );
}

class RecordCategoryOverride {
  const RecordCategoryOverride({
    required this.categoryId,
    required this.name,
    required this.isHidden,
  });
  final String categoryId;
  final String? name;
  final bool isHidden;

  factory RecordCategoryOverride.fromRow(Map<String, dynamic> row) =>
      RecordCategoryOverride(
        categoryId: '${row['category_id']}',
        name: row['name'] as String?,
        isHidden: row['is_hidden'] as bool? ?? false,
      );
}

class VisibleRecordSubcategory {
  const VisibleRecordSubcategory({required this.id, required this.name});
  final String id;
  final String name;
}

class VisibleRecordMainCategory {
  const VisibleRecordMainCategory({
    required this.id,
    required this.name,
    required this.sortOrder,
    required this.subcategories,
  });
  final String id;
  final String name;
  final int sortOrder;
  final List<VisibleRecordSubcategory> subcategories;
}

class RecordCategorySearchResult {
  const RecordCategorySearchResult({
    required this.mainCategoryId,
    required this.mainCategoryName,
    required this.subcategoryId,
    required this.subcategoryName,
  });
  final String mainCategoryId;
  final String mainCategoryName;
  final String subcategoryId;
  final String subcategoryName;
}
