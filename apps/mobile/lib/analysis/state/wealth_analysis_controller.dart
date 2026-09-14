import 'package:flutter/foundation.dart';

import '../../core/data_change.dart';
import '../data/wealth_analysis_service.dart';
import '../domain/wealth_target_allocation.dart';

enum WealthAnalysisStatus { loading, ready, error }

class WealthAnalysisController extends ChangeNotifier {
  WealthAnalysisController({WealthAnalysisDataSource? service})
    : _service = service ?? WealthAnalysisService() {
    DataChange.instance.addListener(_onDataChanged);
    load();
  }

  final WealthAnalysisDataSource _service;

  WealthAnalysisStatus status = WealthAnalysisStatus.loading;
  WealthAnalysisData? data;
  Object? loadError;
  bool isSaving = false;
  bool saveFailed = false;
  var _loadGeneration = 0;
  var _disposed = false;

  @override
  void dispose() {
    _disposed = true;
    _loadGeneration++;
    DataChange.instance.removeListener(_onDataChanged);
    super.dispose();
  }

  void _onDataChanged() => load(silent: true);

  void handleTabActivity({required bool wasActive, required bool isActive}) {
    if (!wasActive && isActive) {
      load(silent: data != null);
    }
  }

  Future<void> load({bool silent = false}) async {
    if (_disposed) return;
    final generation = ++_loadGeneration;
    if (!silent || data == null) {
      status = WealthAnalysisStatus.loading;
      loadError = null;
      _notifyIfActive();
    }
    try {
      final next = await _service.load();
      if (!_isCurrent(generation)) return;
      data = next;
      loadError = null;
      status = WealthAnalysisStatus.ready;
    } catch (error) {
      if (!_isCurrent(generation)) return;
      loadError = error;
      status = data != null && silent
          ? WealthAnalysisStatus.ready
          : WealthAnalysisStatus.error;
    } finally {
      if (_isCurrent(generation)) _notifyIfActive();
    }
  }

  Future<bool> saveTargetPlan(WealthTargetPlan plan) async {
    if (_disposed) return false;
    isSaving = true;
    saveFailed = false;
    _notifyIfActive();
    try {
      await _service.saveTargetPlan(plan);
      if (_disposed) return false;
      data = data?.withTargetPlan(plan);
      return true;
    } catch (_) {
      if (_disposed) return false;
      saveFailed = true;
      return false;
    } finally {
      if (!_disposed) {
        isSaving = false;
        notifyListeners();
      }
    }
  }

  bool _isCurrent(int generation) =>
      !_disposed && generation == _loadGeneration;

  void _notifyIfActive() {
    if (!_disposed) notifyListeners();
  }
}
