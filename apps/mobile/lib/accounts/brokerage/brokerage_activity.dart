// Brokerage activity feed — port of the web `BrokerageActivityItem` shape plus
// the `presentedActivity` / `activityLabel` / `activityAssetEntry` logic in
// `BrokerageAccountDetailsPage.tsx`.
//
// The ledger is append-only: a correction posts a new transaction that points
// at the one it replaces, and a reversal posts one that points at the one it
// backs out. Nothing is ever deleted, so the feed has to work out which rows
// still represent the truth.

import '../../core/decimals.dart';
import '../../i18n/accounts_copy.dart';

/// How a transaction should read once corrections and reversals are applied.
enum ActivityPresentation {
  /// The live version.
  current,

  /// This row is a correction of an earlier one.
  updated,

  /// This row has been reversed.
  deleted,
}

/// One leg of a transaction.
class ActivityEntry {
  const ActivityEntry({
    required this.accountId,
    required this.assetId,
    required this.quantityDelta,
    required this.costBasisDelta,
    required this.accountCostBasisDelta,
    required this.accountFxRate,
    required this.unitPrice,
    required this.transactionAmount,
    required this.accountAmount,
    required this.entrySide,
    required this.memo,
    required this.asset,
  });

  final String? accountId;
  final String? assetId;
  final String? quantityDelta;
  final String? costBasisDelta;
  final String? accountCostBasisDelta;
  final String? accountFxRate;
  final String? unitPrice;
  final String transactionAmount;
  final String accountAmount;
  final String? entrySide; // 'debit' | 'credit'
  final String? memo;

  /// Filled in from the assets lookup the repository runs alongside.
  final ActivityAsset? asset;

  static String? _dec(dynamic value) => value == null ? null : '$value';

  factory ActivityEntry.fromRow(
    Map<String, dynamic> row,
    Map<String, ActivityAsset> assetsById,
  ) {
    final assetId = row['asset_id'] as String?;
    return ActivityEntry(
      accountId: row['account_id'] as String?,
      assetId: assetId,
      quantityDelta: _dec(row['quantity_delta']),
      costBasisDelta: _dec(row['cost_basis_delta']),
      accountCostBasisDelta: _dec(row['account_cost_basis_delta']),
      accountFxRate: _dec(row['account_fx_rate']),
      unitPrice: _dec(row['unit_price']),
      transactionAmount: '${row['transaction_amount'] ?? '0'}',
      accountAmount: '${row['account_amount'] ?? '0'}',
      entrySide: row['entry_side'] as String?,
      memo: row['memo'] as String?,
      asset: assetId == null ? null : assetsById[assetId],
    );
  }
}

/// The trimmed asset row the activity feed joins in.
class ActivityAsset {
  const ActivityAsset({
    required this.id,
    required this.name,
    required this.symbol,
    required this.exchange,
    required this.currencyCode,
  });

  final String id;
  final String name;
  final String? symbol;
  final String? exchange;
  final String currencyCode;

  factory ActivityAsset.fromRow(Map<String, dynamic> row) => ActivityAsset(
    id: '${row['id']}',
    name: '${row['name']}',
    symbol: row['symbol'] as String?,
    exchange: row['exchange'] as String?,
    currencyCode: '${row['currency_code']}',
  );
}

/// One posted transaction touching this brokerage account.
class ActivityItem {
  const ActivityItem({
    required this.id,
    required this.occurredAt,
    required this.transactionTypeCode,
    required this.transactionCurrencyCode,
    required this.notes,
    required this.reversesTransactionId,
    required this.correctsTransactionId,
    required this.entries,
    this.presentation = ActivityPresentation.current,
  });

  final String id;
  final String occurredAt;

  /// `buy` | `sell` | `opening_position` | `opening_position_reversal` |
  /// `dividend` | `transfer`
  final String transactionTypeCode;
  final String transactionCurrencyCode;
  final String? notes;
  final String? reversesTransactionId;
  final String? correctsTransactionId;
  final List<ActivityEntry> entries;
  final ActivityPresentation presentation;

  ActivityItem withPresentation(ActivityPresentation value) => ActivityItem(
    id: id,
    occurredAt: occurredAt,
    transactionTypeCode: transactionTypeCode,
    transactionCurrencyCode: transactionCurrencyCode,
    notes: notes,
    reversesTransactionId: reversesTransactionId,
    correctsTransactionId: correctsTransactionId,
    entries: entries,
    presentation: value,
  );

  factory ActivityItem.fromRow(
    Map<String, dynamic> row,
    Map<String, ActivityAsset> assetsById,
  ) => ActivityItem(
    id: '${row['id']}',
    occurredAt: '${row['occurred_at']}',
    transactionTypeCode: '${row['transaction_type_code']}',
    transactionCurrencyCode: '${row['transaction_currency_code'] ?? ''}',
    notes: row['notes'] as String?,
    reversesTransactionId: row['reverses_transaction_id'] as String?,
    correctsTransactionId: row['corrects_transaction_id'] as String?,
    entries: [
      for (final entry in (row['transaction_entries'] as List? ?? const []))
        ActivityEntry.fromRow(
          (entry as Map).cast<String, dynamic>(),
          assetsById,
        ),
    ],
  );

  bool get isDeleted => presentation == ActivityPresentation.deleted;
  bool get isDividend => transactionTypeCode == 'dividend';

  bool get isReinvestedDividend =>
      entries.any((e) => e.memo == 'brokerage_dividend_reinvestment');

  bool get isPartiallyReinvestedDividend =>
      entries.any((e) => e.memo == 'brokerage_dividend_partial_reinvestment');
}

/// Resolves the append-only ledger into the rows worth showing.
///
/// Three rules, all from the web `presentedActivity`:
///  * `opening_position_reversal` rows never surface — they exist only to undo
///    an opening position, and the row they undo is already marked deleted.
///  * A row that was both reversed *and* corrected is dropped entirely: the
///    correction already replaced it, so showing it twice would double-count.
///  * Otherwise it is `deleted` when something reverses it, `updated` when it
///    is itself a correction, and `current` when neither.
List<ActivityItem> presentActivity(List<ActivityItem> activity) {
  final reversedIds = <String>{
    for (final item in activity)
      if (item.reversesTransactionId != null) item.reversesTransactionId!,
  };
  final correctedOriginalIds = <String>{
    for (final item in activity)
      if (item.correctsTransactionId != null) item.correctsTransactionId!,
  };

  final result = <ActivityItem>[];
  for (final item in activity) {
    if (item.transactionTypeCode == 'opening_position_reversal') continue;
    if (reversedIds.contains(item.id) &&
        correctedOriginalIds.contains(item.id)) {
      continue;
    }
    result.add(
      item.withPresentation(
        reversedIds.contains(item.id)
            ? ActivityPresentation.deleted
            : item.correctsTransactionId != null
            ? ActivityPresentation.updated
            : ActivityPresentation.current,
      ),
    );
  }
  return result;
}

/// The human label for a row (web `activityLabel`). A transfer reads by
/// direction: a debit into this account is money arriving.
String activityLabel(ActivityItem item, String accountId) {
  switch (item.transactionTypeCode) {
    case 'buy':
      return 'Buy';
    case 'sell':
      return 'Sell';
    case 'opening_position':
      return 'Existing holding';
    case 'dividend':
      if (item.isPartiallyReinvestedDividend) {
        return 'Dividend partially reinvested';
      }
      if (item.isReinvestedDividend) return 'Dividend reinvested';
      return 'Dividend';
    default:
      final entry = item.entries
          .where((e) => e.accountId == accountId)
          .firstOrNull;
      return entry?.entrySide == 'debit' ? 'Transfer in' : 'Transfer out';
  }
}

String localizedActivityLabel(
  ActivityItem item,
  String accountId,
  AccountsCopy copy,
) {
  final entry = item.entries
      .where((entry) => entry.accountId == accountId)
      .firstOrNull;
  return copy.brokerageActivityLabel(
    item.transactionTypeCode,
    incoming: entry?.entrySide == 'debit',
    reinvested: item.isReinvestedDividend,
    partiallyReinvested: item.isPartiallyReinvestedDividend,
  );
}

/// The entry that carries the asset movement — web `activityAssetEntry`.
/// Reinvestment legs win over the plain ones because a reinvested dividend has
/// both a cash leg and an asset leg.
ActivityEntry? activityAssetEntry(ActivityItem item) {
  ActivityEntry? byMemo(String memo) =>
      item.entries.where((e) => e.memo == memo).firstOrNull;

  return byMemo('brokerage_dividend_partial_reinvestment') ??
      byMemo('brokerage_dividend_reinvestment') ??
      item.entries
          .where(
            (e) => const [
              'brokerage_buy_asset',
              'brokerage_sell_asset',
              'brokerage_dividend_gross',
            ].contains(e.memo),
          )
          .firstOrNull ??
      item.entries
          .where(
            (e) =>
                e.assetId != null &&
                e.quantityDelta != null &&
                (D.compare(e.quantityDelta!, '0') ?? 0) != 0,
          )
          .firstOrNull;
}

/// Sums one field across every entry carrying [memo]. Null when no entry
/// matches — distinct from a genuine zero (web `sumEntries`).
String? sumEntries(
  List<ActivityEntry> entries,
  String memo,
  String Function(ActivityEntry) field,
) {
  String? total;
  for (final entry in entries) {
    if (entry.memo != memo) continue;
    final value = field(entry);
    total = total == null ? value : (D.add(total, value) ?? total);
  }
  return total;
}

/// Drops a leading minus — ledger entries are signed, the UI shows direction
/// with words and colour instead.
String absoluteDecimal(String value) =>
    value.startsWith('-') ? value.substring(1) : value;

/// Activity grouped under its local calendar date, newest first.
class ActivityDateGroup {
  const ActivityDateGroup({required this.date, required this.items});
  final String date; // yyyy-MM-dd, local
  final List<ActivityItem> items;
}

List<ActivityDateGroup> groupActivityByLocalDate(List<ActivityItem> items) {
  final groups = <String, List<ActivityItem>>{};
  final order = <String>[];
  for (final item in items) {
    final parsed = DateTime.tryParse(item.occurredAt)?.toLocal();
    final key = parsed == null
        ? item.occurredAt
        : '${parsed.year.toString().padLeft(4, '0')}-'
              '${parsed.month.toString().padLeft(2, '0')}-'
              '${parsed.day.toString().padLeft(2, '0')}';
    if (!groups.containsKey(key)) order.add(key);
    (groups[key] ??= []).add(item);
  }
  return [
    for (final key in order) ActivityDateGroup(date: key, items: groups[key]!),
  ];
}
