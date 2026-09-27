import 'dart:async';
import '../core/mutation_refresh.dart';
import 'package:flutter/foundation.dart';
import '../core/read_deadline.dart';
import '../errors/safe_app_error.dart';
import '../i18n/app_language.dart';

import 'account_models.dart';
import 'account_custom_order.dart';
import 'accounts_repository.dart';
import 'accounts_service.dart';

enum AccountsStatus { loading, error, ready }

/// The web inventory sort keys (`AccountInventorySort`).
enum AccountSort { custom, name, type, balance }

enum AccountOrderNotice { conflict, failure, refreshFailure }

/// Drives the Accounts tab (Flow 3). Owns the loaded list, the client-side
/// filter bar (search / type / currency / show-closed), and a `busy`/`error`
/// mutation wrapper. It is the source of account changes, so it does not itself
/// listen to `DataChange`.
class AccountsController extends ChangeNotifier {
  AccountsController({
    AccountsService? service,
    AppLanguage Function()? language,
  }) : _service = service ?? AccountsService(),
       _language = language ?? (() => AppLanguage.en) {
    load();
  }

  final AccountsService _service;
  final AppLanguage Function() _language;

  AccountsStatus status = AccountsStatus.loading;
  AccountsListModel? model;
  bool busy = false;
  bool refreshStale = false;
  String? actionError;
  AccountOrderNotice? orderNotice;
  bool isReordering = false;
  List<String> canonicalIds = [];
  int _loadVersion = 0;
  AppErrorCode? readErrorCode;

  String search = '';
  AccountType? typeFilter;
  String? currencyFilter;
  bool showClosed = false;

  AccountSort sort = AccountSort.custom;
  bool ascending = true;

  /// Web `toggleSort`: same key flips direction, a new key resets to ascending.
  void toggleSort(AccountSort next) {
    if (next == AccountSort.custom) {
      sort = next;
      ascending = true;
      notifyListeners();
      return;
    }
    if (sort == next) {
      ascending = !ascending;
    } else {
      sort = next;
      ascending = true;
    }
    notifyListeners();
  }

  int _compare(AccountItem a, AccountItem b) {
    int result;
    switch (sort) {
      case AccountSort.custom:
        final aIndex = canonicalIds.indexOf(a.account.id);
        final bIndex = canonicalIds.indexOf(b.account.id);
        result = (aIndex < 0 ? canonicalIds.length : aIndex).compareTo(
          bIndex < 0 ? canonicalIds.length : bIndex,
        );
      case AccountSort.name:
        result = a.account.name.toLowerCase().compareTo(
          b.account.name.toLowerCase(),
        );
      case AccountSort.type:
        result = a.account.type.code.compareTo(b.account.type.code);
      case AccountSort.balance:
        final x = double.tryParse(a.value.amount ?? '0') ?? 0;
        final y = double.tryParse(b.value.amount ?? '0') ?? 0;
        result = x.compareTo(y);
    }
    return sort == AccountSort.custom || ascending ? result : -result;
  }

  /// All items passing the filter bar (search / type / currency), before the
  /// active / closed / sold split.
  List<AccountItem> get _filtered =>
      (model?.items ?? const <AccountItem>[]).where(_matches).toList();

  int get resultCount => _filtered.length;

  List<AccountItem> get activeItems =>
      (_filtered.where((i) => i.account.isActive && !i.account.isSold).toList())
        ..sort(_compare);

  List<AccountItem> get closedItems =>
      (_filtered.where((i) => i.account.isClosed).toList())..sort(_compare);

  List<AccountItem> get soldItems =>
      (_filtered.where((i) => i.account.isSold).toList())..sort(_compare);

  bool get isSubsetFiltered =>
      search.trim().isNotEmpty || typeFilter != null || currencyFilter != null;

  bool get hasCompleteOrder => hasCompleteAccountOrder([
    for (final item in model?.items ?? const <AccountItem>[]) item.account.id,
  ], canonicalIds);

  bool get canReorder =>
      status == AccountsStatus.ready &&
      sort == AccountSort.custom &&
      !isSubsetFiltered &&
      !busy &&
      !isReordering &&
      !refreshStale &&
      hasCompleteOrder;

  Future<bool> reorderSection(
    List<String> sectionIds,
    int oldIndex,
    int newIndex,
  ) async {
    if (!canReorder || sectionIds.isEmpty) return false;
    final accountsById = {
      for (final item in model!.items) item.account.id: item.account,
    };
    final source = accountsById[sectionIds.first];
    if (source == null) return false;
    int section(Account account) => account.isSold
        ? 2
        : account.isClosed
        ? 1
        : 0;
    final sectionMembers = {
      for (final account in accountsById.values)
        if (section(account) == section(source)) account.id,
    };
    if (sectionIds.toSet().length != sectionMembers.length ||
        !sectionIds.every(sectionMembers.contains)) {
      return false;
    }
    final expectedIds = [...canonicalIds];
    final orderedIds = reorderAccountSection(
      expectedIds,
      sectionIds,
      oldIndex,
      newIndex,
    );
    if (orderedIds == null) return false;
    isReordering = true;
    orderNotice = null;
    canonicalIds = orderedIds;
    notifyListeners();
    try {
      final committed = await _service.reorderAccounts(expectedIds, orderedIds);
      if (!hasCompleteAccountOrder([
        for (final item in model?.items ?? const <AccountItem>[])
          item.account.id,
      ], committed)) {
        throw StateError('Incomplete committed account order');
      }
      canonicalIds = committed;
      return true;
    } catch (error) {
      canonicalIds = expectedIds;
      final refreshed = await load(preserveOnError: true);
      orderNotice = !refreshed
          ? AccountOrderNotice.refreshFailure
          : error is AccountOrderConflict
          ? AccountOrderNotice.conflict
          : AccountOrderNotice.failure;
      return false;
    } finally {
      isReordering = false;
      notifyListeners();
    }
  }

  /// Currencies actually present (for the currency filter chip menu).
  List<String> get availableCurrencies {
    final set = <String>{};
    for (final i in model?.items ?? const <AccountItem>[]) {
      set.add(i.account.currencyCode);
    }
    final list = set.toList()..sort();
    return list;
  }

  Future<bool> load({bool preserveOnError = false}) async {
    final version = ++_loadVersion;
    if (!preserveOnError) status = AccountsStatus.loading;
    notifyListeners();
    try {
      final next = await readWithDeadline(
        compositeReadDeadline,
        (_) => _service.loadAccounts(),
      );
      if (version != _loadVersion) return false;
      model = next;
      canonicalIds = [...next.canonicalIds];
      orderNotice = null;
      readErrorCode = null;
      status = AccountsStatus.ready;
      refreshStale = false;
      notifyListeners();
      return true;
    } catch (error) {
      if (version != _loadVersion) return false;
      readErrorCode = classifyAppError(error).code;
      if (preserveOnError) refreshStale = true;
      if (!preserveOnError) {
        model = null;
        canonicalIds = [];
      }
      status = preserveOnError ? AccountsStatus.ready : AccountsStatus.error;
      notifyListeners();
      return false;
    }
  }

  void setSearch(String value) {
    search = value;
    notifyListeners();
  }

  void setTypeFilter(AccountType? type) {
    typeFilter = type;
    notifyListeners();
  }

  void setCurrencyFilter(String? code) {
    currencyFilter = code;
    notifyListeners();
  }

  void toggleShowClosed() {
    showClosed = !showClosed;
    notifyListeners();
  }

  void clearActionError() {
    if (actionError == null) return;
    actionError = null;
    notifyListeners();
  }

  bool _matches(AccountItem item) {
    final a = item.account;
    if (typeFilter != null && a.type != typeFilter) return false;
    if (currencyFilter != null && a.currencyCode != currencyFilter) {
      return false;
    }
    if (search.trim().isNotEmpty &&
        !a.name.toLowerCase().contains(search.trim().toLowerCase())) {
      return false;
    }
    return true;
  }

  bool get hasVisibleAccounts =>
      activeItems.isNotEmpty || closedItems.isNotEmpty || soldItems.isNotEmpty;

  Future<bool> runCreate(
    Future<void> Function(AccountsService s) action,
  ) async {
    if (busy) return false;
    busy = true;
    actionError = null;
    notifyListeners();
    final outcome = await runMutation(
      () => action(_service),
      errorMessage: (e) => safeAppErrorMessage(e, _language()),
    );
    busy = false;
    if (outcome is MutationRejected) {
      actionError = outcome.message;
      notifyListeners();
      return false;
    }
    notifyListeners();
    unawaited(load(preserveOnError: true));
    return true;
  }

  Future<void> retryRefresh() async {
    await load(preserveOnError: true);
  }

  Future<bool> run(Future<void> Function(AccountsService s) action) async {
    busy = true;
    actionError = null;
    notifyListeners();
    try {
      await action(_service);
      await load();
      return true;
    } on AccountsException catch (e) {
      actionError = safeAppErrorMessage(e, _language());
      return false;
    } catch (_) {
      actionError = 'Something went wrong. Please try again.';
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  AccountsService get service => _service;
}
