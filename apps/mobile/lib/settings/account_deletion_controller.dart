import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

enum AccountDeletionFailure {
  unauthenticated,
  reauthenticationFailed,
  deletionFailed,
  uncertain,
}

class AccountDeletionException implements Exception {
  const AccountDeletionException(this.failure);

  final AccountDeletionFailure failure;
}

abstract interface class AccountDeletionGateway {
  Future<void> reauthenticate(String password);
  Future<void> deleteCurrentAccount(String password);
  Future<void> clearLocalSession();
}

abstract interface class AccountDeletionExit {
  void forceSignedOut();
}

Map<String, String> deleteAccountRequestBody(String password) => {
  'password': password,
};

class SupabaseAccountDeletionGateway implements AccountDeletionGateway {
  SupabaseAccountDeletionGateway(this._client);

  final SupabaseClient _client;

  @override
  Future<void> reauthenticate(String password) async {
    final caller = await _validatedCaller();
    try {
      final response = await _client.auth.signInWithPassword(
        email: caller.email!,
        password: password,
      );
      if (response.user?.id != caller.id) {
        throw const AccountDeletionException(
          AccountDeletionFailure.reauthenticationFailed,
        );
      }
    } on AccountDeletionException {
      rethrow;
    } on AuthRetryableFetchException {
      throw const AccountDeletionException(AccountDeletionFailure.uncertain);
    } on AuthException {
      throw const AccountDeletionException(
        AccountDeletionFailure.reauthenticationFailed,
      );
    }
  }

  Future<User> _validatedCaller() async {
    if (_client.auth.currentSession == null) {
      throw const AccountDeletionException(
        AccountDeletionFailure.unauthenticated,
      );
    }
    try {
      final response = await _client.auth.getUser();
      final user = response.user;
      if (user == null || user.email == null) {
        throw const AccountDeletionException(
          AccountDeletionFailure.unauthenticated,
        );
      }
      return user;
    } on AccountDeletionException {
      rethrow;
    } on AuthException {
      throw const AccountDeletionException(
        AccountDeletionFailure.unauthenticated,
      );
    }
  }

  @override
  Future<void> deleteCurrentAccount(String password) async {
    if (_client.auth.currentSession == null) {
      throw const AccountDeletionException(
        AccountDeletionFailure.unauthenticated,
      );
    }
    try {
      final response = await _client.functions.invoke(
        'delete-account',
        body: deleteAccountRequestBody(password),
      );
      if (response.status != 204) {
        throw const AccountDeletionException(
          AccountDeletionFailure.deletionFailed,
        );
      }
    } on FunctionsFetchException {
      if (await _isConfirmedDeleted()) return;
      throw const AccountDeletionException(AccountDeletionFailure.uncertain);
    } on FunctionsHttpException catch (error) {
      final code = _errorCode(error.details);
      if (code == 'reauthentication_failed') {
        throw const AccountDeletionException(
          AccountDeletionFailure.reauthenticationFailed,
        );
      }
      if (error.status == 401 || code == 'unauthenticated') {
        throw const AccountDeletionException(
          AccountDeletionFailure.unauthenticated,
        );
      }
      throw const AccountDeletionException(
        AccountDeletionFailure.deletionFailed,
      );
    } on FunctionException {
      throw const AccountDeletionException(
        AccountDeletionFailure.deletionFailed,
      );
    }
  }

  Future<bool> _isConfirmedDeleted() async {
    try {
      await _client.auth.getUser();
      return false;
    } on AuthException catch (error) {
      return error.code == 'user_not_found';
    } catch (_) {
      return false;
    }
  }

  String? _errorCode(dynamic details) {
    if (details is! Map) return null;
    final error = details['error'];
    return error is Map && error['code'] is String
        ? error['code'] as String
        : null;
  }

  @override
  Future<void> clearLocalSession() =>
      _client.auth.signOut(scope: SignOutScope.local);
}

enum AccountDeletionStep { closed, password, confirmation, completed }

class AccountDeletionController extends ChangeNotifier {
  AccountDeletionController({
    required AccountDeletionGateway gateway,
    required AccountDeletionExit exit,
    required this.email,
  }) : _gateway = gateway,
       _exit = exit;

  final AccountDeletionGateway _gateway;
  final AccountDeletionExit _exit;
  final String email;

  AccountDeletionStep step = AccountDeletionStep.closed;
  AccountDeletionFailure? failure;
  bool _inFlight = false;
  String _password = '';
  String _confirmation = '';

  bool get inFlight => _inFlight;
  bool get canConfirmEmail =>
      step == AccountDeletionStep.confirmation &&
      _confirmation == email &&
      email.isNotEmpty &&
      !_inFlight;

  void open() {
    _clearSensitive();
    failure = null;
    step = AccountDeletionStep.password;
    notifyListeners();
  }

  void setPassword(String value) => _password = value;

  void setConfirmation(String value) {
    _confirmation = value;
    notifyListeners();
  }

  void cancel() {
    if (_inFlight) return;
    _clearSensitive();
    failure = null;
    step = AccountDeletionStep.closed;
    notifyListeners();
  }

  Future<void> submitPassword() async {
    if (_inFlight || _password.isEmpty) return;
    _setWorking();
    try {
      await _gateway.reauthenticate(_password);
      failure = null;
      step = AccountDeletionStep.confirmation;
    } on AccountDeletionException catch (error) {
      _password = '';
      failure = error.failure;
      step = AccountDeletionStep.password;
      if (error.failure == AccountDeletionFailure.unauthenticated) {
        await _forceSignedOut();
      }
    } catch (_) {
      _password = '';
      failure = AccountDeletionFailure.reauthenticationFailed;
      step = AccountDeletionStep.password;
    } finally {
      _finishWorking();
    }
  }

  Future<void> permanentlyDelete() async {
    if (_inFlight || !canConfirmEmail) return;
    final password = _password;
    _setWorking();
    try {
      await _gateway.deleteCurrentAccount(password);
      _clearSensitive();
      failure = null;
      step = AccountDeletionStep.completed;
      _exit.forceSignedOut();
      try {
        await _gateway.clearLocalSession();
      } catch (_) {
        // Server deletion is final; local cleanup is strictly best-effort.
      }
    } on AccountDeletionException catch (error) {
      _clearSensitive();
      failure = error.failure;
      step = AccountDeletionStep.password;
      if (error.failure == AccountDeletionFailure.unauthenticated) {
        await _forceSignedOut();
      }
    } catch (_) {
      _clearSensitive();
      failure = AccountDeletionFailure.deletionFailed;
      step = AccountDeletionStep.password;
    } finally {
      _finishWorking();
    }
  }

  Future<void> _forceSignedOut() async {
    _exit.forceSignedOut();
    try {
      await _gateway.clearLocalSession();
    } catch (_) {}
  }

  void _setWorking() {
    _inFlight = true;
    failure = null;
    notifyListeners();
  }

  void _finishWorking() {
    _inFlight = false;
    notifyListeners();
  }

  void _clearSensitive() {
    _password = '';
    _confirmation = '';
  }
}
