// Pure helpers for the account-records ledger — port of
// account-records.service.ts + record-categories.service.ts (the non-RPC parts).

import '../account_models.dart';
import 'records_models.dart';

/// Groups newest-first records by their server-supplied local calendar date.
List<AccountRecordDateGroup> groupAccountRecordsByLocalDate(
  List<AccountRecord> records,
) {
  final groups = <String, AccountRecordDateGroup>{};
  for (final record in records) {
    final existing = groups[record.localDate];
    if (existing != null) {
      existing.records.add(record);
    } else {
      groups[record.localDate] = AccountRecordDateGroup(
        date: record.localDate,
        dailyNet: record.dailyNet,
        currencyCode: record.currencyCode,
        records: [record],
      );
    }
  }
  return groups.values.toList();
}

/// Category label for a ledger row (web `getAccountRecordCategoryLabel`).
String? accountRecordCategoryLabel(
  AccountRecord record,
  List<VisibleRecordMainCategory> categories,
) {
  if (record.type == 'transfer') return null;
  for (final main in categories) {
    for (final sub in main.subcategories) {
      if (sub.id == record.subcategoryId) return sub.name;
    }
  }
  final stripped = record.description.replaceFirst(
    RegExp(r'^(Income|Expense):\s*', caseSensitive: false),
    '',
  );
  return stripped.isEmpty ? record.type : stripped;
}

/// Cash / Bank accounts that can hold records (web `getRecordAccounts`).
List<Account> recordAccounts(List<Account> accounts) => [
  for (final a in accounts)
    if (a.isActive &&
        (a.type == AccountType.cash || a.type == AccountType.bank))
      a,
];

/// `"{name} — {type} — {CODE}"` picker label (web `getAccountDisplayLabel`).
String accountPickerLabel(Account a) =>
    '${a.name} — ${a.typeLabel} — ${a.currencyCode}';

// ---- category tree ------------------------------------------------------

List<VisibleRecordMainCategory> buildVisibleRecordCategoryTree(
  List<RecordCategory> categories,
  List<RecordCategoryOverride> overrides,
) {
  final overrideBy = {for (final o in overrides) o.categoryId: o};
  bool visible(RecordCategory c) =>
      !c.isArchived && !(overrideBy[c.id]?.isHidden ?? false);

  final visibleCats = categories.where(visible).toList();
  final mains = visibleCats.where((c) => c.isMain).toList()
    ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));

  return [
    for (final main in mains)
      VisibleRecordMainCategory(
        id: main.id,
        name: overrideBy[main.id]?.name ?? main.name,
        sortOrder: main.sortOrder,
        subcategories:
            (visibleCats
                    .where(
                      (c) => c.level == 'subcategory' && c.parentId == main.id,
                    )
                    .toList()
                  ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder)))
                .map(
                  (s) => VisibleRecordSubcategory(
                    id: s.id,
                    name: overrideBy[s.id]?.name ?? s.name,
                  ),
                )
                .toList(),
      ),
  ];
}

List<RecordCategorySearchResult> searchVisibleRecordCategories(
  List<VisibleRecordMainCategory> categories,
  String query,
) {
  final q = query.trim().toLowerCase();
  return [
    for (final main in categories)
      for (final sub in main.subcategories)
        if (q.isEmpty ||
            main.name.toLowerCase().contains(q) ||
            sub.name.toLowerCase().contains(q))
          RecordCategorySearchResult(
            mainCategoryId: main.id,
            mainCategoryName: main.name,
            subcategoryId: sub.id,
            subcategoryName: sub.name,
          ),
  ];
}

int nextRecordCategorySortOrder(
  List<RecordCategory> categories,
  String? parentId,
) {
  var max = 0;
  for (final c in categories) {
    if (c.parentId == parentId && c.sortOrder > max) max = c.sortOrder;
  }
  return max + 1;
}
