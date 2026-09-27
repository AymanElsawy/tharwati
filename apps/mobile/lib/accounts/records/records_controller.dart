import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import '../../errors/safe_app_error.dart';
import '../../i18n/app_language.dart';

import '../../core/data_change.dart';
import '../../core/retained_mutation.dart';
import '../../core/decimals.dart';
import '../../core/local_datetime.dart';
import '../../i18n/accounts_copy.dart';
import 'record_submission.dart';
import '../../core/mutation_refresh.dart';
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
  RecordsController({required this.accountId, RecordsRepository? repository,
    this.writeDeadline = ledgerWriteDeadline,
    AppLanguage Function()? language})
    : _repo = repository ?? RecordsRepository(),
      _language = language ?? (() => AppLanguage.en);

  final String accountId;
  final RecordsRepository _repo;
  final AppLanguage Function() _language;
  final Duration writeDeadline;

  RecordsStatus status = RecordsStatus.loading;
  List<AccountRecord> records = const [];
  List<VisibleRecordMainCategory> categories = const [];
  bool categoriesResolved = false;
  AccountRecordHistoryFilters filters = AccountRecordHistoryFilters();

  AccountRecordHistoryCursor? _cursor;
  bool hasMore = false;
  bool loadingMore = false;
  String? pageError;
  bool busy = false;
  String? actionError;
  String? accountBalance;
  bool hasAuthoritativeBalance = false;
  bool refreshStale = false;
  final _mutations = RetainedMutations();
  MutationOutcome? mutationOutcome;
  bool get hasUncertainMutation => _mutations.hasUncertain;
  int _mutationVersion = 0;
  int _mutationViewVersion = 0;
  bool _disposed = false;

  @override
  void dispose() {
    _disposed = true;
    _requestVersion++;
    _mutationVersion++;
    super.dispose();
  }

  int _requestVersion = 0;

  List<AccountRecordDateGroup> get groups =>
      groupAccountRecordsByLocalDate(records);

  Future<({Map<String, String> values, bool available})>
  _loadAccountBalance() async {
    try {
      return (
        values: await _repo.getAccountBalances([accountId]),
        available: true,
      );
    } catch (_) {
      return (values: const <String, String>{}, available: false);
    }
  }

  Future<bool> load({bool preserveOnError = false}) async {
    final version = ++_requestVersion;
    if (!preserveOnError) status = RecordsStatus.loading;
    pageError = null;
    notifyListeners();
    try {
      final results = await Future.wait<dynamic>([
        _repo.getHistoryPage(accountId, null, _pageSize, filters),
        _loadAccountBalance(),
      ]);
      final page = results[0] as AccountRecordHistoryPage;
      final balanceResult =
          results[1] as ({Map<String, String> values, bool available});
      if (version != _requestVersion) return false;
      records = page.records;
      _cursor = page.nextCursor;
      hasMore = page.hasMore;
      if (balanceResult.available) {
        accountBalance = balanceResult.values[accountId];
        hasAuthoritativeBalance = true;
      } else if (!preserveOnError) {
        accountBalance = null;
        hasAuthoritativeBalance = true;
      } else {
        refreshStale = true;
      }
      refreshStale = !balanceResult.available && preserveOnError;
      status = RecordsStatus.ready;
      notifyListeners();
      try {
        final cats = await _repo.getCategories();
        final overrides = await _repo.getOverrides();
        if (version == _requestVersion) {
          categories = buildVisibleRecordCategoryTree(cats, overrides);
          categoriesResolved = true;
        }
      } catch (_) {
        if (version == _requestVersion) {
          categories = const [];
          categoriesResolved = true;
        }
      }
    } catch (_) {
      if (version != _requestVersion) return false;
      if (preserveOnError) {
        refreshStale = true;
        status = RecordsStatus.ready;
      } else {
        records = const [];
        _cursor = null;
        hasMore = false;
        status = RecordsStatus.error;
      }
      if (version == _requestVersion) notifyListeners();
      return false;
    }
    if (version == _requestVersion) notifyListeners();
    return true;
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
      pageError = safeAppErrorMessage(e, _language());
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
    _mutationViewVersion++;
    if (actionError == null) return;
    actionError = null;
    notifyListeners();
  }

  Future<EditableAccountRecord?> openForEdit(String recordId) async {
    try {
      return await _repo.getEditableRecord(recordId);
    } catch (e) {
      actionError = safeAppErrorMessage(e, _language());
      notifyListeners();
      return null;
    }
  }

  Future<bool> submit(
    AccountRecordFormValues values, {
    String? editingId,
    bool Function()? isCurrent,
    VoidCallback? onCommitted,
  }) async {
    if (editingId != null) {
      return _run(() => _repo.correctRecord(editingId, values));
    }
    final payload = values.copy();
    return _runLedger(_mutations.prepare('$accountId:record.create',
      accountRecordSubmissionFingerprint(payload),
      (key) => _repo.addRecord(payload, key)),
      isCurrent: isCurrent, onCommitted: onCommitted);
  }

  Future<bool> reverse(String recordId) =>
      _run(() => _repo.reverseRecord(recordId));

  Future<bool> cancelRefund(String recordId) async {
    return _runLedger(_mutations.prepare('$accountId:refund.cancel', recordId,
      (key) => _repo.cancelRefund(recordId, key)));
  }

  Future<ExpenseRefundSummary?> refundSummary(String expenseId) async {
    try {
      return await _repo.refundSummary(expenseId);
    } catch (e) {
      actionError = safeAppErrorMessage(e, _language());
      notifyListeners();
      return null;
    }
  }

  Future<bool> addRefund({
    required String expenseId,
    required String amount,
    required String accountId,
    required String occurredAt,
    required String notes,
    required String idempotencyKey,
    bool Function()? isCurrent,
    VoidCallback? onCommitted,
  }) => _runLedger(_mutations.prepare('${this.accountId}:refund.create',
    jsonEncode([expenseId, D.normalize(amount), accountId,
      localDateTimeInputToIso(occurredAt), notes.trim()]),
    (key) => _repo.addRefund(
      expenseId: expenseId,
      amount: amount,
      accountId: accountId,
      occurredAt: occurredAt,
      notes: notes,
      idempotencyKey: key,
    ), key: idempotencyKey),
    isCurrent: isCurrent, onCommitted: onCommitted,
  );

  Future<bool> _runLedger(RetainedMutationAttempt attempt, {
    bool Function()? isCurrent,
    VoidCallback? onCommitted,
  }) async {
    if (busy || _disposed) return false;
    final version = ++_mutationVersion;
    final view = _mutationViewVersion;
    busy = true;
    actionError = null;
    notifyListeners();
    var notifiedUncertain = _mutations.hasUncertain;
    void apply(MutationOutcome outcome) {
      if (_disposed) return;
      final hasUncertain = _mutations.hasUncertain;
      if (version != _mutationVersion) {
        if (hasUncertain != notifiedUncertain) notifyListeners();
        notifiedUncertain = hasUncertain;
        return;
      }
      notifiedUncertain = hasUncertain;
      busy = false;
      mutationOutcome = outcome;
      if (view == _mutationViewVersion && (isCurrent?.call() ?? true)) {
        actionError = outcome is MutationUncertain
            ? AccountsCopy.of(_language()).mutationUncertain
            : outcome is MutationRejected ? outcome.message : null;
        if (isMutationCommitted(outcome)) {
          if (onCommitted != null) {
            _mutations.acknowledge(attempt);
            onCommitted();
          }
        }
      }
      notifyListeners();
    }
    final outcome = await _mutations.run(attempt,
      deadline: writeDeadline,
      errorMessage: (error) => error is AccountsException &&
          error.message == 'invalid_refund_request'
          ? AccountsCopy.of(_language()).invalidRefundRequest
          : safeAppErrorMessage(error, _language()),
      refresh: () async {
        if (_disposed) throw StateError('Owner disposed');
        DataChange.instance.ping();
        if (!await load(preserveOnError: true) || refreshStale) {
          throw StateError('Refresh unavailable');
        }
      },
      onLateOutcome: apply,
    );
    apply(outcome);
    return isMutationCommitted(outcome);
  }

  Future<bool> _run(Future<void> Function() action) async {
    _mutationVersion++;
    busy = true;
    actionError = null;
    notifyListeners();
    final outcome = await runMutation(
      action,
      errorMessage: (error) => error is AccountsException &&
              error.message == 'invalid_refund_request'
          ? error.message
          : safeAppErrorMessage(error, _language()),
    );
    if (outcome is MutationCommitted) {
      DataChange.instance.ping();
      busy = false;
      notifyListeners();
      unawaited(load(preserveOnError: true));
      return true;
    }
    if (outcome is MutationRejected) {
      actionError = outcome.message;
    }
    busy = false;
    notifyListeners();
    return false;
  }

  Future<void> retryRefresh() async {
    await load(preserveOnError: true);
    if (isMutationCommitted(mutationOutcome)) {
      mutationOutcome = refreshStale
          ? const MutationCommittedRefreshFailed() : const MutationCommitted();
    }
  }

  Future<void> reloadCategories() async {
    try {
      final cats = await _repo.getCategories();
      final overrides = await _repo.getOverrides();
      categories = buildVisibleRecordCategoryTree(cats, overrides);
      categoriesResolved = true;
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
