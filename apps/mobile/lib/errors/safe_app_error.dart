import 'dart:async';
import 'dart:io';

import 'package:supabase_flutter/supabase_flutter.dart';

import '../i18n/app_language.dart';

enum AppErrorCode {
  validation,
  businessRule,
  unauthorized,
  forbidden,
  offline,
  timeout,
  serviceUnavailable,
  marketPriceUnavailable,
  fxUnavailable,
  fxStale,
  unknown,
}

enum AppMutationOutcome { rejected, committedRefreshFailed, uncertain }

abstract interface class AppErrorCarrier {
  AppErrorCode get appErrorCode;
  Object? get originalCause;
  String? get trustedBusinessMessage;
}

class ClassifiedAppError {
  const ClassifiedAppError(this.code, this.cause);
  final AppErrorCode code;
  final Object cause;
}

/// Uses protocol codes and exception types, never backend message contents.
ClassifiedAppError classifyAppError(Object error) {
  if (error is AppErrorCarrier) {
    return ClassifiedAppError(error.appErrorCode, error.originalCause ?? error);
  }
  if (error is TimeoutException) return ClassifiedAppError(AppErrorCode.timeout, error);
  if (error is SocketException) return ClassifiedAppError(AppErrorCode.offline, error);
  if (error is AuthException) {
    if (error.statusCode == '403') return ClassifiedAppError(AppErrorCode.forbidden, error);
    return ClassifiedAppError(AppErrorCode.unauthorized, error);
  }
  if (error is PostgrestException) {
    final code = switch (error.code) {
      '42501' => AppErrorCode.forbidden,
      'PGRST301' => AppErrorCode.unauthorized,
      '23503' || '23505' || '23514' => AppErrorCode.businessRule,
      '22P02' || '23502' || 'PGRST100' => AppErrorCode.validation,
      _ => AppErrorCode.serviceUnavailable,
    };
    return ClassifiedAppError(code, error);
  }
  if (error is FunctionException) {
    final code = switch (error.status) {
      401 => AppErrorCode.unauthorized,
      403 => AppErrorCode.forbidden,
      _ => AppErrorCode.serviceUnavailable,
    };
    return ClassifiedAppError(code, error);
  }
  return ClassifiedAppError(AppErrorCode.unknown, error);
}

String safeAppErrorMessage(Object error, AppLanguage language) {
  final classified = classifyAppError(error);
  if (language == AppLanguage.en && error is AppErrorCarrier &&
      error.trustedBusinessMessage != null) {
    return error.trustedBusinessMessage!;
  }
  final ar = language == AppLanguage.ar;
  return switch (classified.code) {
    AppErrorCode.validation => ar ? 'تحقق من البيانات ثم حاول مرة أخرى.' : 'Check the information and try again.',
    AppErrorCode.businessRule => ar ? 'لا يمكن إجراء هذا التغيير في الحالة الحالية.' : 'This change is not allowed in the current state.',
    AppErrorCode.unauthorized => ar ? 'انتهت جلستك. سجّل الدخول مرة أخرى.' : 'Your session has expired. Sign in again.',
    AppErrorCode.forbidden => ar ? 'ليس لديك صلاحية لإجراء ذلك.' : 'You do not have permission to do that.',
    AppErrorCode.offline => ar ? 'يبدو أنك غير متصل بالإنترنت. تحقق من اتصالك.' : 'You appear to be offline. Check your connection.',
    AppErrorCode.timeout => ar ? 'استغرق الطلب وقتًا طويلًا. حاول مرة أخرى.' : 'The request took too long. Please try again.',
    AppErrorCode.serviceUnavailable => ar ? 'الخدمة غير متاحة الآن. حاول لاحقًا.' : 'The service is unavailable right now. Please try again later.',
    AppErrorCode.marketPriceUnavailable => ar ? 'سعر السوق غير متاح. لا يمكن حساب القيمة.' : 'A market price is unavailable. The value cannot be calculated.',
    AppErrorCode.fxUnavailable => ar ? 'سعر الصرف غير متاح. لا يمكن تحويل القيمة.' : 'An exchange rate is unavailable. The value cannot be converted.',
    AppErrorCode.fxStale => ar ? 'سعر الصرف قديم. راجعه قبل الاعتماد على القيمة.' : 'The exchange rate is out of date. Review it before relying on this value.',
    AppErrorCode.unknown => ar ? 'حدث خطأ. حاول مرة أخرى.' : 'Something went wrong. Please try again.',
  };
}
