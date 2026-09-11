import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/local_datetime.dart';
import '../accounts_repository.dart' show AccountsException;
import 'records_models.dart';

/// RPC layer for the account-records ledger — 1:1 with the web
/// `account-records.repository.ts` / `record-categories.repository.ts` calls
/// against the same Supabase project.
class RecordsRepository {
  RecordsRepository([SupabaseClient? client])
    : _client = client ?? Supabase.instance.client;

  final SupabaseClient _client;
  String get _userId => _client.auth.currentUser!.id;

  // ---- history ----------------------------------------------------------

  Future<List<Map<String, dynamic>>> _historyRows(
    String accountId,
    AccountRecordHistoryCursor? cursor,
    int pageSize,
    AccountRecordHistoryFilters f,
  ) async {
    final rows = await _client.rpc(
      'get_account_record_history',
      params: {
        'p_account_id': accountId,
        'p_cursor_occurred_at': cursor?.occurredAt,
        'p_cursor_id': cursor?.id,
        'p_page_size': pageSize,
        'p_time_zone': runtimeTimeZone(),
        'p_search': f.search.trim().isEmpty ? null : f.search.trim(),
        'p_from_date': f.fromDate.isEmpty ? null : f.fromDate,
        'p_to_date': f.toDate.isEmpty ? null : f.toDate,
        'p_record_type': f.recordType?.code,
        'p_main_category_id': f.mainCategoryId.isEmpty
            ? null
            : f.mainCategoryId,
        'p_subcategory_id': f.subcategoryId.isEmpty ? null : f.subcategoryId,
        'p_min_amount': f.minAmount.trim().isEmpty ? null : f.minAmount.trim(),
        'p_max_amount': f.maxAmount.trim().isEmpty ? null : f.maxAmount.trim(),
      },
    );
    return [for (final r in rows as List) (r as Map).cast<String, dynamic>()];
  }

  Future<AccountRecordHistoryPage> getHistoryPage(
    String accountId,
    AccountRecordHistoryCursor? cursor,
    int pageSize,
    AccountRecordHistoryFilters filters,
  ) async {
    try {
      final rows = await _historyRows(accountId, cursor, pageSize, filters);
      final records = <AccountRecord>[
        for (final row in rows) ?AccountRecord.fromHistoryRow(row),
      ];
      final last = rows.isEmpty ? null : rows.last;
      return AccountRecordHistoryPage(
        records: records,
        nextCursor: last == null
            ? null
            : AccountRecordHistoryCursor(
                occurredAt: '${last['occurred_at']}',
                id: '${last['id']}',
              ),
        hasMore: rows.length == pageSize,
      );
    } on PostgrestException catch (e) {
      throw AccountsException(e.message);
    }
  }

  // ---- mutations ------------------------------------------------------

  Map<String, dynamic> _recordParams(AccountRecordFormValues v) {
    final isTransfer = v.type == AccountRecordType.transfer;
    return {
      'p_record_type': v.type.code,
      'p_account_id': v.accountId,
      'p_counterparty_account_id': isTransfer ? v.toAccountId : null,
      'p_amount': v.amount.trim(),
      'p_received_amount': isTransfer
          ? (v.receivedAmount.trim().isEmpty ? null : v.receivedAmount.trim())
          : null,
      'p_occurred_at': localDateTimeInputToIso(v.occurredAt),
      'p_category': null,
      'p_notes': v.notes.trim().isEmpty ? null : v.notes.trim(),
      'p_main_category_id': isTransfer ? null : v.mainCategoryId,
      'p_subcategory_id': isTransfer ? null : v.subcategoryId,
    };
  }

  Future<void> addRecord(AccountRecordFormValues v) =>
      _rpc('add_account_record', _recordParams(v));

  Future<void> correctRecord(String recordId, AccountRecordFormValues v) =>
      _rpc('correct_account_record', {
        'p_transaction_id': recordId,
        ..._recordParams(v),
      });

  Future<void> reverseRecord(String recordId) =>
      _rpc('reverse_account_record', {'p_transaction_id': recordId});

  Future<void> _rpc(String fn, Map<String, dynamic> params) async {
    try {
      await _client.rpc(fn, params: params);
    } on PostgrestException catch (e) {
      throw AccountsException(_friendly(e));
    }
  }

  // ---- editable record detail ---------------------------------------

  static const _detailSelect =
      'id,occurred_at,transaction_type_code,description,notes,main_category_id,'
      'subcategory_id,reverses_transaction_id,corrects_transaction_id,'
      'transaction_currency_code,'
      'account_entries:transaction_entries!inner(account_id,entry_side,'
      'account_amount::text,account:financial_accounts!transaction_entries_account_id_fkey(currency_code))';

  Future<EditableAccountRecord> getEditableRecord(String recordId) async {
    try {
      final row = await _client
          .from('financial_transactions')
          .select(_detailSelect)
          .eq('id', recordId)
          .eq('user_id', _userId)
          .single();
      return _mapEditable((row).cast<String, dynamic>());
    } on PostgrestException catch (e) {
      throw AccountsException(_friendly(e));
    }
  }

  EditableAccountRecord _mapEditable(Map<String, dynamic> row) {
    final entries = [
      for (final e in (row['account_entries'] as List? ?? const []))
        (e as Map).cast<String, dynamic>(),
    ];
    Map<String, dynamic>? entryFor(String side) {
      for (final e in entries) {
        if (e['entry_side'] == side && e['account_id'] != null) return e;
      }
      return null;
    }

    final type = '${row['transaction_type_code']}';
    final occurredAt = formatLocalDateTimeInput(
      DateTime.tryParse('${row['occurred_at']}'),
    );

    if (type == 'income' || type == 'expense') {
      final entry = entryFor(type == 'income' ? 'debit' : 'credit');
      final amount = entry?['account_amount'];
      if (entry == null || entry['account_id'] == null || amount == null) {
        throw AccountsException('This record can’t be edited.');
      }
      return EditableAccountRecord(
        id: '${row['id']}',
        values: AccountRecordFormValues(
          type: AccountRecordTypeX.fromCode(type),
          accountId: '${entry['account_id']}',
          amount: '$amount',
          mainCategoryId: row['main_category_id'] as String? ?? '',
          subcategoryId: row['subcategory_id'] as String? ?? '',
          occurredAt: occurredAt,
          notes: row['notes'] as String? ?? '',
        ),
      );
    }

    final source = entryFor('credit');
    final destination = entryFor('debit');
    if (type != 'transfer' ||
        source?['account_id'] == null ||
        destination?['account_id'] == null) {
      throw AccountsException('This record can’t be edited.');
    }
    return EditableAccountRecord(
      id: '${row['id']}',
      values: AccountRecordFormValues(
        type: AccountRecordType.transfer,
        accountId: '${source!['account_id']}',
        toAccountId: '${destination!['account_id']}',
        amount: '${source['account_amount']}',
        receivedAmount: '${destination['account_amount']}',
        occurredAt: occurredAt,
        notes: row['notes'] as String? ?? '',
      ),
    );
  }

  // ---- balances -----------------------------------------------------

  Future<Map<String, String>> getAccountBalances(List<String> ids) async {
    if (ids.isEmpty) return const {};
    final rows = await _client.rpc(
      'get_account_balances',
      params: {'p_account_ids': ids},
    );
    return {
      for (final r in rows as List)
        '${(r as Map)['account_id']}': '${r['current_balance'] ?? '0'}',
    };
  }

  // ---- categories --------------------------------------------------

  Future<List<RecordCategory>> getCategories() async {
    final rows = await _client
        .from('record_categories')
        .select(
          'id,user_id,parent_id,system_code,level,name,sort_order,is_archived',
        )
        .order('sort_order');
    return [
      for (final r in rows as List)
        RecordCategory.fromRow((r as Map).cast<String, dynamic>()),
    ];
  }

  Future<List<RecordCategoryOverride>> getOverrides() async {
    final rows = await _client
        .from('record_category_overrides')
        .select('category_id,name,is_hidden');
    return [
      for (final r in rows as List)
        RecordCategoryOverride.fromRow((r as Map).cast<String, dynamic>()),
    ];
  }

  Future<void> createCustomCategory({
    required String? parentId,
    required String level,
    required String name,
    required int sortOrder,
  }) => _catWrite(
    () => _client.from('record_categories').insert({
      'user_id': _userId,
      'parent_id': parentId,
      'level': level,
      'name': name.trim(),
      'sort_order': sortOrder,
    }),
  );

  Future<void> updateCustomCategory(
    String id, {
    String? name,
    bool? isArchived,
  }) {
    final patch = <String, dynamic>{};
    if (name != null) patch['name'] = name.trim();
    if (isArchived != null) patch['is_archived'] = isArchived;
    return _catWrite(
      () => _client.from('record_categories').update(patch).eq('id', id),
    );
  }

  Future<void> setDefaultOverride(
    String categoryId, {
    String? name,
    required bool isHidden,
  }) => _catWrite(
    () => _client.from('record_category_overrides').upsert({
      'user_id': _userId,
      'category_id': categoryId,
      'name': (name ?? '').trim().isEmpty ? null : name!.trim(),
      'is_hidden': isHidden,
    }, onConflict: 'user_id,category_id'),
  );

  Future<void> restoreDefault(String categoryId) => _catWrite(
    () => _client
        .from('record_category_overrides')
        .delete()
        .eq('category_id', categoryId),
  );

  Future<void> _catWrite(Future<dynamic> Function() op) async {
    try {
      await op();
    } on PostgrestException catch (e) {
      throw AccountsException(_friendly(e));
    }
  }

  static String _friendly(PostgrestException e) {
    final m = e.message.toLowerCase();
    if (m.contains('exchange rate') || m.contains('fx')) {
      return 'A current exchange rate is unavailable.';
    }
    if (e.code == 'PGRST116' || m.contains('not found')) {
      return 'That record is no longer available.';
    }
    if (e.code == '42501') return 'You don’t have permission to do that.';
    return e.message;
  }
}
