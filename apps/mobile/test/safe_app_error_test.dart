import 'dart:async';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:tharwati_mobile/accounts/accounts_repository.dart';
import 'package:tharwati_mobile/errors/safe_app_error.dart';
import 'package:tharwati_mobile/i18n/app_language.dart';

void main() {
  test('raw PostgREST and RPC text remains in the cause, not user copy', () {
    final raw = PostgrestException(
      message: 'duplicate key on financial_accounts in create_financial_account_v2',
      code: '23505',
      details: 'secret table name',
    );
    final failure = AccountsException.fromPostgrest(raw, 'A safe account rule message.');
    expect(classifyAppError(failure).code, AppErrorCode.businessRule);
    expect(classifyAppError(failure).cause, same(raw));
    expect(safeAppErrorMessage(failure, AppLanguage.en), 'A safe account rule message.');
    expect(safeAppErrorMessage(failure, AppLanguage.ar), isNot(contains('financial_accounts')));
    expect(safeAppErrorMessage(raw, AppLanguage.en), isNot(contains('create_financial_account_v2')));
  });

  test('auth and forbidden are distinct; unknown text is generic', () {
    expect(safeAppErrorMessage(
      PostgrestException(message: 'invalid input syntax for type uuid', code: '22P02'),
      AppLanguage.en,
    ), 'Check the information and try again.');
    expect(classifyAppError(PostgrestException(message: 'JWT stack', code: 'PGRST301')).code,
        AppErrorCode.unauthorized);
    expect(classifyAppError(PostgrestException(message: 'RLS table', code: '42501')).code,
        AppErrorCode.forbidden);
    expect(safeAppErrorMessage(Exception('select * from private_table'), AppLanguage.en),
        'Something went wrong. Please try again.');
  });

  test('transport and unavailable-value taxonomy never invents zero', () {
    expect(classifyAppError(const SocketException('no network')).code, AppErrorCode.offline);
    expect(classifyAppError(TimeoutException('expired')).code, AppErrorCode.timeout);
    expect(classifyAppError(PostgrestException(message: 'provider stack')).code,
        AppErrorCode.serviceUnavailable);
    for (final code in [AppErrorCode.marketPriceUnavailable, AppErrorCode.fxUnavailable, AppErrorCode.fxStale]) {
      final failure = AccountsException('provider stack', appErrorCode: code);
      final message = safeAppErrorMessage(failure, AppLanguage.en);
      expect(message, isNot(contains('provider stack')));
      expect(message, isNot(contains('0')));
    }
  });
}
