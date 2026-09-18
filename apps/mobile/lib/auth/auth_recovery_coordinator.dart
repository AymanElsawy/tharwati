import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Narrow auth surface used by [AuthRecoveryCoordinator].
///
/// Keeping URI exchange behind this interface makes cold/warm-link behavior
/// testable without initializing the Supabase singleton.
abstract interface class RecoveryAuthClient {
  Stream<AuthChangeEvent> get authEvents;

  Future<bool> exchangeAuthCallback(Uri uri);
}

enum AuthRecoveryStatus { idle, active }

/// Owns Mobile auth callback exchange and exposes only validated recovery state.
///
/// Supabase URI auto-detection is disabled at initialization. This coordinator
/// subscribes to Auth events before exchanging the captured cold-start URI, so a
/// PASSWORD_RECOVERY event cannot be lost before the widget tree exists.
class AuthRecoveryCoordinator extends ChangeNotifier {
  AuthRecoveryCoordinator(this._auth);

  static final _authorizationCodePattern = RegExp(
    r'^[A-Za-z0-9._~-]{16,2048}$',
  );

  final RecoveryAuthClient _auth;
  final Set<String> _handledUris = <String>{};
  StreamSubscription<AuthChangeEvent>? _authSubscription;
  StreamSubscription<Uri>? _linkSubscription;
  Future<void> _handling = Future<void>.value();
  AuthRecoveryStatus _status = AuthRecoveryStatus.idle;

  AuthRecoveryStatus get status => _status;
  bool get isActive => _status == AuthRecoveryStatus.active;

  Future<void> start({
    required Uri? initialUri,
    required Stream<Uri> linkStream,
  }) async {
    _authSubscription ??= _auth.authEvents.listen(
      _onAuthEvent,
      // Invalid/expired callback failures are handled by exchangeAuthCallback.
      // Other auth-stream errors must not become unhandled zone errors.
      onError: (_, _) {},
    );
    _linkSubscription ??= linkStream.listen(_queueUri, onError: (_, _) {});

    if (initialUri != null) {
      _queueUri(initialUri);
      await _handling;
    }
  }

  void complete() => _clear();

  void cancel() => _clear();

  void _onAuthEvent(AuthChangeEvent event) {
    if (event != AuthChangeEvent.passwordRecovery || isActive) {
      return;
    }
    _activate();
  }

  void _queueUri(Uri uri) {
    _handling = _handling.then((_) => _handleUri(uri));
  }

  Future<void> _handleUri(Uri uri) async {
    try {
      if (!_isAuthCallback(uri) || !_handledUris.add(uri.toString())) {
        return;
      }

      final isRecovery = await _auth.exchangeAuthCallback(uri);
      if (isRecovery) {
        _activate();
      }
    } on AuthException {
      // Expired, malformed, and reused links never activate recovery. The SDK
      // emits PASSWORD_RECOVERY only after a valid session has been exchanged.
    } on FormatException {
      // Treat malformed callback payloads exactly like invalid auth links.
    } catch (_) {
      // Transport and unexpected callback failures stay outside recovery UI and
      // must not poison the serial queue for a later valid link.
    }
  }

  void _activate() {
    if (isActive) {
      return;
    }
    _status = AuthRecoveryStatus.active;
    notifyListeners();
  }

  bool _isAuthCallback(Uri uri) {
    if (uri.scheme != 'tharwati' ||
        uri.host != 'auth-callback' ||
        uri.userInfo.isNotEmpty ||
        uri.hasPort ||
        uri.path.isNotEmpty) {
      return false;
    }

    final query = uri.queryParametersAll;
    final codes = query['code'] ?? const <String>[];
    final queryErrors = uri.queryParametersAll['error'] ?? const <String>[];
    if (uri.fragment.isEmpty &&
        query.length == 1 &&
        codes.length == 1 &&
        _authorizationCodePattern.hasMatch(codes.single)) {
      return true;
    }
    if (codes.isEmpty &&
        queryErrors.length == 1 &&
        queryErrors.single.isNotEmpty) {
      return true;
    }

    try {
      final fragment = Uri.splitQueryString(uri.fragment);
      return fragment.containsKey('access_token') ||
          fragment.containsKey('error');
    } on FormatException {
      return false;
    }
  }

  void _clear() {
    if (!isActive) {
      return;
    }
    _status = AuthRecoveryStatus.idle;
    notifyListeners();
  }

  @override
  void dispose() {
    unawaited(_authSubscription?.cancel());
    unawaited(_linkSubscription?.cancel());
    super.dispose();
  }
}
