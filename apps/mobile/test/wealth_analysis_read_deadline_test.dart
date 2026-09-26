import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:tharwati_mobile/analysis/data/wealth_allocation_targets_repository.dart';
import 'package:tharwati_mobile/analysis/data/wealth_analysis_service.dart';
import 'package:tharwati_mobile/analysis/domain/wealth_target_allocation.dart';
import 'package:tharwati_mobile/core/read_deadline.dart';
import 'package:tharwati_mobile/dashboard/data/dashboard_repository.dart';

class _PendingDashboard extends DashboardRepository {
  _PendingDashboard()
    : super(
        SupabaseClient(
          'http://localhost',
          'test-key',
          authOptions: const AuthClientOptions(autoRefreshToken: false),
        ),
      );

  final request = Completer<String?>();

  @override
  Future<String?> fetchBaseCurrency() => request.future;
}

class _Targets implements WealthAllocationTargetsStore {
  int writes = 0;

  @override
  Future<WealthTargetPlan> load() => Completer<WealthTargetPlan>().future;

  @override
  Future<void> replace(WealthTargetPlan plan) async {
    writes++;
  }
}

void main() {
  testWidgets('Analysis composite timeout settles without invoking a write', (
    tester,
  ) async {
    final dashboard = _PendingDashboard();
    final targets = _Targets();
    final service = WealthAnalysisService(
      dashboardRepository: dashboard,
      targetsRepository: targets,
    );
    final failure = expectLater(
      service.load(),
      throwsA(isA<ReadTimeoutException>()),
    );
    await tester.pump(const Duration(seconds: 45));
    await failure;
    expect(targets.writes, 0);
    dashboard.request.complete(null);
    await tester.pump();
  });
}
