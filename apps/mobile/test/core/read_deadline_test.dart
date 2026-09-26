import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/core/read_deadline.dart';
import 'package:tharwati_mobile/errors/safe_app_error.dart';
import 'package:tharwati_mobile/i18n/app_language.dart';

void main() {
  test('deadline aborts a read and maps only expiry to timeout', () async {
    Future<void>? abort;
    final pending = readWithDeadline<String>(const Duration(milliseconds: 10), (
      signal,
    ) {
      abort = signal;
      return Completer<String>().future;
    });
    await expectLater(pending, throwsA(isA<ReadTimeoutException>()));
    await expectLater(abort, completes);
    expect(
      classifyAppError(ReadTimeoutException(const Duration(seconds: 1))).code,
      AppErrorCode.timeout,
    );
    expect(
      safeAppErrorCodeMessage(AppErrorCode.timeout, AppLanguage.en),
      'The request took too long. Please try again.',
    );
    expect(
      safeAppErrorCodeMessage(AppErrorCode.timeout, AppLanguage.ar),
      isNot(contains('provider')),
    );
    expect(
      safeAppErrorCodeMessage(AppErrorCode.timeout, AppLanguage.ar),
      isNotEmpty,
    );
    expect(AppErrorCode.timeout, isNot(AppErrorCode.fxUnavailable));
    expect(AppErrorCode.timeout, isNot(AppErrorCode.marketPriceUnavailable));
  });

  test('parent abort is not a timeout', () async {
    final parent = Completer<void>();
    final pending = readWithDeadline<String>(
      const Duration(seconds: 1),
      (_) => Completer<String>().future,
      parentAbort: parent.future,
    );
    parent.complete();
    await expectLater(pending, throwsA(isA<ReadAbortedException>()));
    expect(
      classifyAppError(const ReadAbortedException()).code,
      isNot(AppErrorCode.timeout),
    );
  });

  test('late read completion cannot change the settled outcome', () async {
    final transport = Completer<String>();
    final pending = readWithDeadline<String>(
      const Duration(milliseconds: 10),
      (_) => transport.future,
    );
    await expectLater(pending, throwsA(isA<ReadTimeoutException>()));
    transport.complete('late');
    await Future<void>.delayed(Duration.zero);
  });
}
