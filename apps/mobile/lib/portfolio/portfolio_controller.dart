import 'package:flutter/foundation.dart';

import '../core/data_change.dart';
import 'portfolio_models.dart';
import 'portfolio_repository.dart';
import 'portfolio_valuation.dart';

enum PortfolioLoadStatus { initial, loading, ready, error }

class PortfolioController extends ChangeNotifier {
  PortfolioController({PortfolioLoader? loader, Listenable? changes})
    : _loader = loader ?? PortfolioRepository(),
      _changes = changes ?? DataChange.instance {
    _changes.addListener(_onDataChanged);
  }
  final PortfolioLoader _loader;
  final Listenable _changes;
  int _request = 0;
  String _scopeId = allBrokerageAccountsScope;

  PortfolioLoadStatus status = PortfolioLoadStatus.initial;
  PortfolioAnalysis? data;
  Object? error;
  Object? refreshError;
  bool isRefreshing = false;
  String get scopeId => _scopeId;

  Future<void> load() => _run(refresh: data != null);

  Future<void> selectScope(String scopeId) async {
    _scopeId = scopeId;
    await _run(refresh: data != null);
  }

  Future<void> refresh() => _run(refresh: data != null);

  Future<void> _run({required bool refresh}) async {
    final request = ++_request;
    final requestedScope = _scopeId;
    if (refresh) {
      isRefreshing = true;
      refreshError = null;
    } else {
      status = PortfolioLoadStatus.loading;
      error = null;
    }
    notifyListeners();
    try {
      final source = await _loader.load();
      final next = valuePortfolio(source, scopeId: requestedScope);
      if (request != _request) return;
      data = next;
      status = PortfolioLoadStatus.ready;
      error = null;
      refreshError = null;
    } catch (caught) {
      if (request != _request) return;
      if (data == null) {
        status = PortfolioLoadStatus.error;
        error = caught;
      } else {
        refreshError = caught;
      }
    } finally {
      if (request == _request) {
        isRefreshing = false;
        notifyListeners();
      }
    }
  }

  void _onDataChanged() => refresh();

  @override
  void dispose() {
    _changes.removeListener(_onDataChanged);
    super.dispose();
  }
}
