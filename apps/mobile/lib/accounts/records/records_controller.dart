import 'package:flutter/foundation.dart';

import '../../core/data_change.dart';
import '../account_models.dart';
import '../accounts_repository.dart' show AccountsException;
import 'records_models.dart';
import 'records_repository.dart';
import 'records_service.dart';

const _pageSize = 50;

enum RecordsStatus { loading, error, ready }

/// Drives one Cash / Bank account's records ledger (web `AccountRecordsPage`
/// state): a filtered, cursor-paginated history plus add / correct / reverse
/// mutations, and the visible category tree used for labels and the picker.
class RecordsController extends ChangeNotifier {
  RecordsController({required this.accountId, RecordsRepository? repository})
    : _repo = repository ?? RecordsRepository();

  final String accountId;
  final RecordsRepository _repo;

  RecordsStatus status = RecordsStatus.loading;
  List<AccountRecord> records = const [];
  List<VisibleRecordMainCategory> categories = const [];
  AccountRecordHistoryFilters filters = AccountRecordHistoryFilters();

  AccountRecordHistoryCursor? _cursor;
  bool hasMore = false;
  bool loadingMore = false;
  String? pageError;
  bool busy = false;
  String? actionError;

  int _requestVersion = 0;

  List<AccountRecordDateGroup> get groups =>
      groupAccountRecordsByLocalDate(records);

  Future<void> load() async {
    final version = ++_requestVersion;
    status = RecordsStatus.loading;
    pageError = null;
    notifyListeners();
    try {
      final page = await _repo.getHistoryPage(
        accountId,
        null,
        _pageSize,
        filters,
      );
      if (version != _requestVersion) return;
      records = page.records;
      _cursor = page.nextCursor;
      hasMore = page.hasMore;
      status = RecordsStatus.ready;
      try {
        final cats = await _repo.getCategories();
        final overrides = await _repo.getOverrides();
        if (version == _requestVersion) {
          categories = buildVisibleRecordCategoryTree(cats, overrides);
        }
      } catch (_) {
        if (version == _requestVersion) categories = const [];
      }
    } catch (_) {
      if (version != _requestVersion) return;
      records = const [];
      _cursor = null;
      hasMore = false;
      status = RecordsStatus.error;
    }
    if (version == _requestVersion) notifyListeners();
  }

  Future<void> loadMore() async {
    if (_cursor == null || !hasMore || loadingMore || pageError != null) return;
    loadingMore = true;
    notifyListeners();
    final version = _requestVersion;
    try {
      final page = await _repo.getHistoryPage(
        accountId,
        _cursor,
        _pageSize,
        filters,
      );
      if (version != _requestVersion) return;
      records = [...records, ...page.records];
      _cursor = page.nextCursor;
      hasMore = page.hasMore;
    } catch (e) {
      pageError = e is AccountsException
          ? e.message
          : 'We couldn’t load account records.';
    } finally {
      loadingMore = false;
      notifyListeners();
    }
  }

  void setFilters(AccountRecordHistoryFilters next) {
    filters = next;
    load();
  }

  void clearFilters() => setFilters(AccountRecordHistoryFilters());

  void clearActionError() {
    if (actionError == null) return;
    actionError = null;
    notifyListeners();
  }

  Future<EditableAccountRecord?> openForEdit(String recordId) async {
    try {
      return await _repo.getEditableRecord(recordId);
    } catch (e) {
      actionError = e is AccountsException
          ? e.message
          : 'We couldn’t load account records.';
      notifyListeners();
      return null;
    }
  }

  Future<bool> submit(AccountRecordFormValues values, {String? editingId}) =>
      _run(
        () => editingId == null
            ? _repo.addRecord(values)
            : _repo.correctRecord(editingId, values),
      );

  Future<bool> reverse(String recordId) =>
      _run(() => _repo.reverseRecord(recordId));

  Future<bool> _run(Future<void> Function() action) async {
    busy = true;
    actionError = null;
    notifyListeners();
    try {
      await action();
      await load();
      DataChange.instance.ping();
      return true;
    } on AccountsException catch (e) {
      actionError = e.message;
      return false;
    } catch (_) {
      actionError = 'We couldn’t save this record. Please try again.';
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> reloadCategories() async {
    try {
      final cats = await _repo.getCategories();
      final overrides = await _repo.getOverrides();
      categories = buildVisibleRecordCategoryTree(cats, overrides);
      notifyListeners();
    } catch (_) {}
  }
}

/// Same-currency transfers mirror the sent amount; cross-currency requires a
/// manual "amount received" (mobile has no live FX service — web deviation,
/// noted in docs/accounts.md §10).
String? autoReceivedAmount(Account? from, Account? to, String amount) {
  if (from == null || to == null) return null;
  if (from.currencyCode == to.currencyCode) return amount;
  return null;
}
