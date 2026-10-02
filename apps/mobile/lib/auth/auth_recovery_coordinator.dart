import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'recovery_marker_store.dart';

abstract interface class RecoveryAuthClient {
  bool get hasRecoveryOrigin;
  Stream<AuthChangeEvent> get authEvents;
  Future<bool> exchangeAuthCallback(Uri uri);
  Future<bool> validateRecoverySession();
  Future<void> clearRecoverySession();
}

enum AuthRecoveryStatus {
  idle,
  checking,
  active,
  invalid,
  transportFailure,
  ended,
}

/// Persistence contains only a phase. URI/code retry state stays in memory.
class AuthRecoveryCoordinator extends ChangeNotifier {
  AuthRecoveryCoordinator(this._auth, {RecoveryMarkerStore? store})
    : _store = store ?? MemoryRecoveryMarkerStore();

  static final _authorizationCodePattern = RegExp(
    r'^[A-Za-z0-9._~-]{16,2048}$',
  );
  final RecoveryAuthClient _auth;
  final RecoveryMarkerStore _store;
  final Set<String> _handledUris = <String>{};
  StreamSubscription<AuthChangeEvent>? _authSubscription;
  StreamSubscription<Uri>? _linkSubscription;
  Future<void> _handling = Future<void>.value();
  Future<void> _markerWrites = Future<void>.value();
  AuthRecoveryStatus _status = AuthRecoveryStatus.idle;
  Uri? _retryUri;
  bool _started = false;
  bool _disposed = false;
  int _generation = 0;

  AuthRecoveryStatus get status => _status;
  bool get isActive => _status == AuthRecoveryStatus.active;
  bool get isIsolating =>
      _status != AuthRecoveryStatus.idle && _status != AuthRecoveryStatus.ended;
  bool get requiresFreshLogin => _status == AuthRecoveryStatus.ended;
  bool get canRetry => _retryUri != null;

  Future<void> start({
    required Uri? initialUri,
    required Stream<Uri> linkStream,
  }) async {
    if (!_started) {
      var marker = await _store.read(); // Storage failure blocks bootstrap.
      if (marker == null && _auth.hasRecoveryOrigin) {
        await _writeMarker('active');
        marker = 'active';
      }
      if (marker != null) {
        _set(AuthRecoveryStatus.checking);
        if (marker == 'ended') {
          await _cleanup();
          _set(AuthRecoveryStatus.ended);
        } else if (marker == 'active') {
          try {
            _set(
              await _auth.validateRecoverySession().timeout(
                    const Duration(seconds: 10),
                  )
                  ? AuthRecoveryStatus.active
                  : AuthRecoveryStatus.invalid,
            );
          } catch (_) {
            _set(AuthRecoveryStatus.invalid);
          }
        } else {
          // Interrupted exchange must never become an ordinary restored login.
          _set(AuthRecoveryStatus.invalid);
        }
      }
      _authSubscription = _auth.authEvents.listen(
        _onAuthEvent,
        onError: (_, _) {},
      );
      _linkSubscription = linkStream.listen(_queueUri, onError: (_, _) {});
      _started = true;
    }
    if (initialUri != null) {
      _queueUri(initialUri);
      await _handling;
    }
  }

  void _onAuthEvent(AuthChangeEvent event) {
    if (event == AuthChangeEvent.signedIn &&
        isActive &&
        !_auth.hasRecoveryOrigin) {
      // Do not reset a different session from an in-flight ordinary login.
      _generation++;
      _set(AuthRecoveryStatus.invalid);
      unawaited(_writeMarker('checking').catchError((Object _) {}));
    }
    if (event == AuthChangeEvent.signedOut && isActive) {
      _set(AuthRecoveryStatus.invalid);
    }
    // A timed-out SDK exchange can finish late, even after a new password login.
    // Restrict routing synchronously before ordinary AuthGate listeners see it.
    if ((_status == AuthRecoveryStatus.idle ||
            _status == AuthRecoveryStatus.transportFailure) &&
        (event == AuthChangeEvent.passwordRecovery ||
            _auth.hasRecoveryOrigin)) {
      final generation = _generation;
      _set(AuthRecoveryStatus.checking);
      unawaited(() async {
        try {
          await _writeMarker('active');
          final valid = await _auth.validateRecoverySession().timeout(
            const Duration(seconds: 10),
          );
          if (generation == _generation) {
            _set(
              valid ? AuthRecoveryStatus.active : AuthRecoveryStatus.invalid,
            );
          }
        } catch (_) {
          if (generation == _generation) _set(AuthRecoveryStatus.invalid);
        }
      }());
    }
  }

  Future<void> _writeMarker(String? phase) {
    final write = _markerWrites.then((_) => _store.write(phase));
    _markerWrites = write.catchError((Object _) {});
    return write;
  }

  Future<void> acceptNormalSession() async {
    if (!requiresFreshLogin) return;
    await _writeMarker(null);
    _set(AuthRecoveryStatus.idle);
  }

  Future<void> complete() => _finish();
  Future<void> cancel() => _finish();
  void invalidate() {
    _generation++;
    _retryUri = null;
    _set(AuthRecoveryStatus.invalid);
    unawaited(_writeMarker('checking').catchError((Object _) {}));
  }

  Future<void> _cleanup() async {
    try {
      await _auth.clearRecoverySession().timeout(const Duration(seconds: 5));
    } catch (_) {
      /* Ended marker prevents leaked restored-session routing. */
    }
  }

  Future<void> _finish() async {
    _generation++;
    _retryUri = null;
    // Keep an ended marker until an explicit successful password login/signup.
    // If persistence fails, the old pending marker still isolates on restart.
    try {
      await _writeMarker('ended');
    } catch (_) {}
    _set(AuthRecoveryStatus.checking);
    await _cleanup();
    _set(AuthRecoveryStatus.ended);
  }

  Future<void> retry() async {
    final uri = _retryUri;
    if (uri == null) return;
    _queueUri(uri);
    await _handling;
  }

  void _queueUri(Uri uri) {
    _handling = _handling.then((_) => _handleUri(uri));
  }

  Future<void> _handleUri(Uri uri) async {
    // Non-auth URLs never enter the flow. Exact callback shape remains required.
    if (uri.scheme != 'tharwati' || uri.host != 'auth-callback') return;
    if (!_isAuthCallback(uri)) {
      invalidate();
      return;
    }
    if (_handledUris.contains(uri.toString())) {
      if (!isActive) invalidate();
      return;
    }
    final generation = _generation;
    _retryUri = null;
    _set(AuthRecoveryStatus.checking);
    try {
      // Persist isolation BEFORE the SDK can store the exchanged session.
      await _writeMarker('checking');
      final recovery = await _auth
          .exchangeAuthCallback(uri)
          .timeout(const Duration(seconds: 15));
      if (generation != _generation) {
        await _cleanup();
        return;
      }
      await _writeMarker(recovery ? 'active' : null);
      if (generation != _generation) {
        await _cleanup();
        return;
      }
      _handledUris.add(
        uri.toString(),
      ); // Only a successful exchange is deduped.
      _set(recovery ? AuthRecoveryStatus.active : AuthRecoveryStatus.idle);
    } on AuthRetryableFetchException {
      if (generation == _generation) {
        _retryUri = uri;
        _set(AuthRecoveryStatus.transportFailure);
      }
    } on AuthException {
      if (generation == _generation) _set(AuthRecoveryStatus.invalid);
    } on FormatException {
      if (generation == _generation) _set(AuthRecoveryStatus.invalid);
    } catch (_) {
      if (generation == _generation) {
        _retryUri = uri;
        _set(AuthRecoveryStatus.transportFailure);
      }
    }
  }

  void _set(AuthRecoveryStatus value) {
    if (_disposed || _status == value) return;
    _status = value;
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
    if (codes.isNotEmpty) {
      return uri.fragment.isEmpty &&
          query.length == 1 &&
          codes.length == 1 &&
          _authorizationCodePattern.hasMatch(codes.single);
    }

    if (codes.isEmpty &&
        queryErrors.length == 1 &&
        queryErrors.single.isNotEmpty) {
      return uri.fragment.isEmpty;
    }

    if (query.isNotEmpty) return false;

    try {
      final fragment = Uri.splitQueryString(uri.fragment);
      return fragment.containsKey('access_token') ||
          fragment.containsKey('error');
    } on FormatException {
      return false;
    }
  }

  @override
  void dispose() {
    _disposed = true;
    unawaited(_authSubscription?.cancel());
    unawaited(_linkSubscription?.cancel());
    super.dispose();
  }
}
