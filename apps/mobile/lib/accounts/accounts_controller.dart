import 'package:flutter/foundation.dart';

import 'account_models.dart';
import 'accounts_repository.dart';
import 'accounts_service.dart';

enum AccountsStatus { loading, error, ready }

/// The web inventory sort keys (`AccountInventorySort`).
enum AccountSort { name, type, balance }

/// Drives the Accounts tab (Flow 3). Owns the loaded list, the client-side
/// filter bar (search / type / currency / show-closed), and a `busy`/`error`
/// mutation wrapper. It is the source of account changes, so it does not itself
/// listen to `DataChange`.
class AccountsController extends ChangeNotifier {
  AccountsController({AccountsService? service})
    : _service = service ?? AccountsService() {
    load();
  }

  final AccountsService _service;

  AccountsStatus status = AccountsStatus.loading;
  AccountsListModel? model;
  bool busy = false;
  String? actionError;

  String search = '';
  AccountType? typeFilter;
  String? currencyFilter;
  bool showClosed = false;

  AccountSort sort = AccountSort.name;
  bool ascending = true;

  /// Web `toggleSort`: same key flips direction, a new key resets to ascending.
  void toggleSort(AccountSort next) {
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
    return ascending ? result : -result;
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

  /// Currencies actually present (for the currency filter chip menu).
  List<String> get availableCurrencies {
    final set = <String>{};
    for (final i in model?.items ?? const <AccountItem>[]) {
      set.add(i.account.currencyCode);
    }
    final list = set.toList()..sort();
    return list;
  }

  Future<void> load() async {
    status = AccountsStatus.loading;
    notifyListeners();
    try {
      model = await _service.loadAccounts();
      status = AccountsStatus.ready;
    } catch (_) {
      model = null;
      status = AccountsStatus.error;
    }
    notifyListeners();
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

  Future<bool> run(Future<void> Function(AccountsService s) action) async {
    busy = true;
    actionError = null;
    notifyListeners();
    try {
      await action(_service);
      await load();
      return true;
    } on AccountsException catch (e) {
      actionError = e.message;
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
