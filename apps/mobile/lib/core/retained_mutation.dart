import 'dart:async';
import 'dart:convert';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../errors/safe_app_error.dart';
import 'idempotency_key.dart';
import 'mutation_refresh.dart';

const ledgerWriteDeadline = Duration(seconds: 45);

bool isMutationCommitted(MutationOutcome? outcome) =>
    outcome is MutationCommitted || outcome is MutationCommittedRefreshFailed;

bool isDefinitiveMutationRejection(Object error) {
  if (error is AppErrorCarrier &&
      error.originalCause != null &&
      !identical(error.originalCause, error)) {
    return isDefinitiveMutationRejection(error.originalCause!);
  }
  return error is PostgrestException &&
      RegExp(
        r'^(P000[12]|22[0-9A-Z]{3}|23[0-9A-Z]{3}|42501|PGRST100|PGRST301)$',
      ).hasMatch(error.code ?? '');
}

class RetainedMutationAttempt {
  RetainedMutationAttempt(
    this.scope,
    this.fingerprint,
    this.dispatch, {
    String? key,
  }) : id = newIdempotencyKey(),
       idempotencyKey = key ?? newIdempotencyKey();
  final String id, scope, fingerprint, idempotencyKey;
  final Future<void> Function(String key) dispatch;
  MutationOutcome? outcome;
  Future<MutationOutcome>? refreshing;
  int pendingWrites = 0;
  bool ambiguousTransport = false;
}

/// Deliberately in memory: no recovery promise after this owner is discarded.
class RetainedMutations {
  final _attempts = <String, RetainedMutationAttempt>{};
  bool get hasUncertain =>
      _attempts.values.any((a) => a.outcome is MutationUncertain);

  RetainedMutationAttempt prepare(
    String scope,
    String fingerprint,
    Future<void> Function(String key) dispatch, {
    String? key,
  }) => _attempts.putIfAbsent(
    jsonEncode([scope, fingerprint]),
    () => RetainedMutationAttempt(scope, fingerprint, dispatch, key: key),
  );

  void acknowledge(RetainedMutationAttempt attempt) {
    final identity = jsonEncode([attempt.scope, attempt.fingerprint]);
    if (isMutationCommitted(attempt.outcome) &&
        identical(_attempts[identity], attempt)) {
      _attempts.remove(identity);
    }
  }

  Future<MutationOutcome> _refresh(
    RetainedMutationAttempt attempt,
    Future<void> Function() read,
  ) async {
    if (attempt.refreshing != null) return attempt.refreshing!;
    attempt.refreshing = () async {
      try {
        await read();
        attempt.outcome = const MutationCommitted();
      } catch (_) {
        attempt.outcome = const MutationCommittedRefreshFailed();
      }
      return attempt.outcome!;
    }();
    try {
      return await attempt.refreshing!;
    } finally {
      attempt.refreshing = null;
    }
  }

  Future<MutationOutcome> run(
    RetainedMutationAttempt attempt, {
    required Future<void> Function() refresh,
    required String Function(Object) errorMessage,
    void Function(MutationOutcome)? onLateOutcome,
    Duration deadline = ledgerWriteDeadline,
  }) {
    if (isMutationCommitted(attempt.outcome)) {
      return _refresh(attempt, refresh);
    }
    attempt.pendingWrites++;
    final result = Completer<MutationOutcome>();
    void finish(MutationOutcome outcome) {
      if (result.isCompleted) {
        onLateOutcome?.call(outcome);
      } else {
        result.complete(outcome);
      }
    }

    final timer = Timer(deadline, () {
      if (!isMutationCommitted(attempt.outcome)) {
        attempt.outcome = const MutationUncertain();
      }
      finish(attempt.outcome!);
    });
    // No automatic write retries. The retained immutable dispatch is reused only
    // when a caller explicitly runs this attempt again.
    Future<void>.sync(() => attempt.dispatch(attempt.idempotencyKey)).then(
      (_) async {
        timer.cancel();
        attempt.pendingWrites--;
        attempt.outcome = const MutationCommitted();
        finish(await _refresh(attempt, refresh));
      },
      onError: (Object error, StackTrace stack) {
        timer.cancel();
        attempt.pendingWrites--;
        if (!isDefinitiveMutationRejection(error)) {
          attempt.ambiguousTransport = true;
        }
        if (!isMutationCommitted(attempt.outcome)) {
          attempt.outcome =
              attempt.ambiguousTransport || attempt.pendingWrites > 0
              ? const MutationUncertain()
              : MutationRejected(errorMessage(error));
        }
        finish(attempt.outcome!);
      },
    );
    return result.future;
  }
}
