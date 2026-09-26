import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:tharwati_mobile/core/read_deadline.dart';
import 'package:tharwati_mobile/errors/safe_app_error.dart';
import 'package:tharwati_mobile/goals/goal_math.dart';
import 'package:tharwati_mobile/goals/goal_models.dart';
import 'package:tharwati_mobile/goals/goals_controller.dart';
import 'package:tharwati_mobile/goals/goals_repository.dart';
import 'package:tharwati_mobile/goals/goals_service.dart';
import 'package:tharwati_mobile/i18n/app_language.dart';

class _GoalsService extends GoalsService {
  _GoalsService()
    : super(
        GoalsRepository(
          SupabaseClient(
            'http://localhost',
            'test-key',
            authOptions: const AuthClientOptions(autoRefreshToken: false),
          ),
        ),
      );

  final reads = <Completer<GoalsReadModel>>[];
  int writes = 0;

  @override
  Future<GoalsReadModel> loadGoals() {
    final request = Completer<GoalsReadModel>();
    reads.add(request);
    return request.future;
  }

  @override
  Future<void> saveGoal(GoalFormInput input, {String? id}) async {
    writes++;
  }
}

void main() {
  test(
    'Goals timeout has safe EN/AR copy; retry reads only and ignores late data',
    () async {
      final service = _GoalsService();
      final controller = GoalsController(service: service);
      final first = service.reads.single;
      final retry = controller.load();
      final second = service.reads.last;
      final timeout = ReadTimeoutException(const Duration(seconds: 12));
      second.completeError(timeout);
      await retry;
      expect(controller.status, GoalsStatus.error);
      expect(
        classifyAppError(controller.loadError!).code,
        AppErrorCode.timeout,
      );
      expect(
        safeAppErrorMessage(timeout, AppLanguage.en),
        isNot(contains('RPC')),
      );
      expect(safeAppErrorMessage(timeout, AppLanguage.ar), isNotEmpty);
      expect(service.writes, 0);

      first.complete(const GoalsReadModel(goals: [], entriesByGoal: {}));
      await Future<void>.delayed(Duration.zero);
      expect(controller.status, GoalsStatus.error);
      controller.dispose();
    },
  );
}
