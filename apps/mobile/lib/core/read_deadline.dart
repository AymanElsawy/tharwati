import 'dart:async';

const simpleReadDeadline = Duration(seconds: 12);
const financialReadDeadline = Duration(seconds: 20);
const marketReadDeadline = Duration(seconds: 20);
const dashboardReadDeadline = Duration(seconds: 30);
const compositeReadDeadline = Duration(seconds: 45);

class ReadTimeoutException extends TimeoutException {
  ReadTimeoutException(Duration duration)
    : super('The read request timed out', duration);

  Object? originalCause;
}

class ReadAbortedException implements Exception {
  const ReadAbortedException();
}

/// Bounds a read and aborts supported transports. A late result is ignored.
Future<T> readWithDeadline<T>(
  Duration duration,
  Future<T> Function(Future<void> abortSignal) read, {
  Future<void>? parentAbort,
}) {
  final abort = Completer<void>();
  final result = Completer<T>();
  var settled = false;
  Timer? timer;
  ReadTimeoutException? timeout;

  void finishValue(T value) {
    if (settled) return;
    settled = true;
    timer?.cancel();
    result.complete(value);
  }

  void finishError(Object error, StackTrace stack) {
    if (settled) {
      if (timeout != null) timeout!.originalCause = error;
      return;
    }
    settled = true;
    timer?.cancel();
    result.completeError(error, stack);
  }

  void cancel(Object error) {
    if (settled) return;
    settled = true;
    timer?.cancel();
    if (!abort.isCompleted) abort.complete();
    result.completeError(error);
  }

  if (parentAbort != null) {
    parentAbort.then(
      (_) => cancel(const ReadAbortedException()),
      onError: (Object error, StackTrace stack) =>
          cancel(const ReadAbortedException()),
    );
  }
  timer = Timer(duration, () {
    timeout = ReadTimeoutException(duration);
    cancel(timeout!);
  });
  Future.sync(() => read(abort.future)).then(finishValue, onError: finishError);
  return result.future;
}
