import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:tharwati_mobile/auth/auth_recovery_coordinator.dart';
import 'package:tharwati_mobile/auth/recovery_marker_store.dart';
import 'package:tharwati_mobile/auth/auth_service.dart';
import 'dart:convert';

void main() {
  late _FakeRecoveryAuth auth;
  late StreamController<Uri> links;
  late AuthRecoveryCoordinator coordinator;

  setUp(() {
    auth = _FakeRecoveryAuth();
    links = StreamController<Uri>.broadcast(sync: true);
    coordinator = AuthRecoveryCoordinator(auth);
  });

  tearDown(() async {
    coordinator.dispose();
    await links.close();
    await auth.dispose();
  });

  test(
    'cold-start password recovery is captured before normal routing',
    () async {
      auth.exchange = (_) async => true;

      await coordinator.start(
        initialUri: _pkceCallback('cold-recovery'),
        linkStream: links.stream,
      );

      expect(coordinator.status, AuthRecoveryStatus.active);
    },
  );

  test('warm-start password recovery activates once', () async {
    final handled = Completer<void>();
    auth.exchange = (_) async {
      handled.complete();
      return true;
    };
    await coordinator.start(initialUri: null, linkStream: links.stream);

    links.add(_pkceCallback('warm-recovery'));
    await handled.future;
    await Future<void>.delayed(Duration.zero);

    expect(coordinator.isActive, isTrue);
  });

  test('normal authenticated startup does not activate recovery', () async {
    await coordinator.start(initialUri: null, linkStream: links.stream);

    auth.emit(AuthChangeEvent.initialSession);

    expect(coordinator.isActive, isFalse);
  });

  test('explicit invalidation remains invalid after restart', () async {
    final store = MemoryRecoveryMarkerStore();
    final flow = AuthRecoveryCoordinator(auth, store: store);
    auth.exchange = (_) async => true;
    await flow.start(
      initialUri: _pkceCallback('invalidated-session'),
      linkStream: const Stream.empty(),
    );
    flow.invalidate();
    await Future<void>.delayed(Duration.zero);
    flow.dispose();
    final restarted = AuthRecoveryCoordinator(auth, store: store);
    await restarted.start(initialUri: null, linkStream: const Stream.empty());
    expect(restarted.status, AuthRecoveryStatus.invalid);
    restarted.dispose();
  });

  test(
    'ordinary session replacement invalidates recovery across restart',
    () async {
      final store = MemoryRecoveryMarkerStore();
      final flow = AuthRecoveryCoordinator(auth, store: store);
      auth.exchange = (_) async => true;
      await flow.start(
        initialUri: _pkceCallback('session-replaced'),
        linkStream: const Stream.empty(),
      );
      auth.emit(AuthChangeEvent.signedIn);
      await Future<void>.delayed(Duration.zero);
      expect(flow.status, AuthRecoveryStatus.invalid);
      flow.dispose();
      final restarted = AuthRecoveryCoordinator(auth, store: store);
      await restarted.start(initialUri: null, linkStream: const Stream.empty());
      expect(restarted.status, AuthRecoveryStatus.invalid);
      restarted.dispose();
    },
  );

  test(
    'normal onboarding confirmation remains ordinary signed-in routing',
    () async {
      auth.exchange = (_) async {
        auth.emit(AuthChangeEvent.signedIn);
        return false;
      };

      await coordinator.start(
        initialUri: _pkceCallback('signup-confirmation'),
        linkStream: links.stream,
      );

      expect(coordinator.isActive, isFalse);
    },
  );

  test(
    'expired and malformed recovery input never activates recovery',
    () async {
      auth.exchange = (_) async => throw const AuthException('expired code');

      await coordinator.start(
        initialUri: _pkceCallback('expired'),
        linkStream: links.stream,
      );
      links.add(Uri.parse('tharwati://auth-callback'));
      links.add(
        Uri(scheme: 'tharwati', host: 'auth-callback', fragment: 'bad%'),
      );
      await Future<void>.delayed(Duration.zero);

      expect(coordinator.isActive, isFalse);
      expect(auth.exchanges, 1);
    },
  );

  test('malformed callback cannot poison a later valid warm link', () async {
    final handled = Completer<void>();
    auth.exchange = (_) async {
      handled.complete();
      return true;
    };
    await coordinator.start(initialUri: null, linkStream: links.stream);

    links.add(Uri.parse('tharwati://auth-callback?code=%'));
    links.add(_pkceCallback('valid-after-malformed'));
    await handled.future;
    await Future<void>.delayed(Duration.zero);

    expect(coordinator.isActive, isTrue);
    expect(auth.exchanges, 1);
  });

  test('lookalike custom-scheme callbacks are rejected', () async {
    await coordinator.start(initialUri: null, linkStream: links.stream);

    for (final uri in <Uri>[
      Uri.parse('tharwati://auth-callback/path?code=path-code'),
      Uri.parse('tharwati://user@auth-callback?code=user-code'),
      Uri.parse('tharwati://auth-callback:443?code=port-code'),
      Uri.parse('tharwati://other-host?code=host-code'),
      Uri.parse('https://example.invalid/auth-callback?code=web-code'),
      Uri.parse('tharwati://auth-callback?code=one&code=two'),
    ]) {
      links.add(uri);
    }
    await Future<void>.delayed(Duration.zero);

    expect(auth.exchanges, 0);
    expect(coordinator.isActive, isFalse);
  });

  test(
    'completion is one-shot and a reused link shows invalid feedback',
    () async {
      final uri = _pkceCallback('one-shot');
      auth.exchange = (_) async => true;
      await coordinator.start(initialUri: uri, linkStream: links.stream);

      await coordinator.complete();
      links.add(uri);
      await Future<void>.delayed(Duration.zero);

      expect(coordinator.isActive, isFalse);
      expect(coordinator.status, AuthRecoveryStatus.invalid);
      expect(auth.exchanges, 1);
    },
  );

  test('cancellation clears active recovery state', () async {
    auth.exchange = (_) async => true;
    await coordinator.start(
      initialUri: _pkceCallback('cancelled'),
      linkStream: links.stream,
    );

    await coordinator.cancel();

    expect(coordinator.isActive, isFalse);
  });

  test('ordinary auth sessions cannot accidentally enter recovery', () async {
    await coordinator.start(initialUri: null, linkStream: links.stream);

    for (final event in <AuthChangeEvent>[
      AuthChangeEvent.signedIn,
      AuthChangeEvent.tokenRefreshed,
      AuthChangeEvent.userUpdated,
    ]) {
      auth.emit(event);
    }

    expect(coordinator.isActive, isFalse);
  });

  test(
    'a late recovery event after fresh login cannot leak into normal routing',
    () async {
      await coordinator.start(initialUri: null, linkStream: links.stream);
      await coordinator.cancel();
      await coordinator.acceptNormalSession();
      auth.emit(AuthChangeEvent.passwordRecovery);
      expect(coordinator.isIsolating, isTrue);
      await Future<void>.delayed(Duration.zero);
      expect(coordinator.isActive, isTrue);
    },
  );

  test(
    'restart restores recovery gate instead of an ordinary session',
    () async {
      final store = MemoryRecoveryMarkerStore();
      final first = AuthRecoveryCoordinator(auth, store: store);
      auth.exchange = (_) async => true;
      await first.start(
        initialUri: _pkceCallback('restart'),
        linkStream: links.stream,
      );
      first.dispose();
      final restored = AuthRecoveryCoordinator(auth, store: store);
      await restored.start(initialUri: null, linkStream: links.stream);
      expect(restored.isActive, isTrue);
      auth.emit(AuthChangeEvent.initialSession);
      expect(restored.isIsolating, isTrue);
      restored.dispose();
    },
  );

  test(
    'an older recovery-origin session reconstructs its missing marker',
    () async {
      auth.hasRecoveryOrigin = true;
      final store = MemoryRecoveryMarkerStore();
      final restored = AuthRecoveryCoordinator(auth, store: store);
      await restored.start(initialUri: null, linkStream: links.stream);
      expect(store.phase, 'active');
      expect(restored.isActive, isTrue);
      restored.dispose();
      String token(String method) =>
          'header.${base64Url.encode(utf8.encode(jsonEncode({
            'amr': [
              {'method': method},
            ],
          })))}.signature';
      expect(sessionHasRecoveryOrigin(token('recovery')), isTrue);
      expect(sessionHasRecoveryOrigin(token('password')), isFalse);
      expect(sessionHasRecoveryOrigin('broken'), isFalse);
    },
  );

  test(
    'interrupted exchange and expired sessions show invalid recovery',
    () async {
      for (final phase in ['checking', 'active']) {
        final store = MemoryRecoveryMarkerStore()..phase = phase;
        auth.validSession = false;
        final restored = AuthRecoveryCoordinator(auth, store: store);
        await restored.start(initialUri: null, linkStream: links.stream);
        expect(restored.status, AuthRecoveryStatus.invalid);
        expect(restored.isIsolating, isTrue);
        restored.dispose();
      }
    },
  );

  test('transport failure permits retrying the identical URI', () async {
    var attempts = 0;
    auth.exchange = (_) async {
      if (++attempts == 1) throw StateError('temporary network failure');
      return true;
    };
    await coordinator.start(
      initialUri: _pkceCallback('retry'),
      linkStream: links.stream,
    );
    expect(coordinator.status, AuthRecoveryStatus.transportFailure);
    expect(coordinator.canRetry, isTrue);
    await coordinator.retry();
    expect(coordinator.isActive, isTrue);
    expect(auth.exchanges, 2);
  });

  test('invalid callback shows feedback without exchanging it', () async {
    await coordinator.start(
      initialUri: Uri.parse('tharwati://auth-callback?code=%'),
      linkStream: links.stream,
    );
    expect(coordinator.status, AuthRecoveryStatus.invalid);
    expect(auth.exchanges, 0);
  });

  test(
    'ended recovery stays signed out across restart despite cleanup failure',
    () async {
      final store = MemoryRecoveryMarkerStore()..phase = 'active';
      final flow = AuthRecoveryCoordinator(auth, store: store);
      await flow.start(initialUri: null, linkStream: links.stream);
      auth.failCleanup = true;
      await flow.complete();
      expect(flow.requiresFreshLogin, isTrue);
      expect(store.phase, 'ended');
      flow.dispose();
      final restored = AuthRecoveryCoordinator(auth, store: store);
      await restored.start(initialUri: null, linkStream: links.stream);
      auth.emit(AuthChangeEvent.initialSession);
      expect(restored.requiresFreshLogin, isTrue);
      await restored.acceptNormalSession();
      expect(restored.status, AuthRecoveryStatus.idle);
      expect(store.phase, isNull);
      restored.dispose();
    },
  );

  test(
    'cancel during exchange cannot activate a late recovery session',
    () async {
      final exchange = Completer<bool>();
      final started = Completer<void>();
      auth.exchange = (_) {
        started.complete();
        return exchange.future;
      };
      final start = coordinator.start(
        initialUri: _pkceCallback('cancel-in-flight'),
        linkStream: links.stream,
      );
      await started.future;
      await coordinator.cancel();
      exchange.complete(true);
      await start;
      expect(coordinator.requiresFreshLogin, isTrue);
      expect(auth.cleanups, greaterThanOrEqualTo(2));
    },
  );

  test(
    'wrong-project legacy tokens are rejected; PKCE stays with selected SDK',
    () {
      Uri callback(String issuer) => Uri.parse(
        'tharwati://auth-callback#access_token=header.${base64Url.encode(utf8.encode(jsonEncode({'iss': issuer})))}.signature',
      );
      const project = 'https://production.example.supabase.co';
      expect(
        callbackMatchesProject(callback('$project/auth/v1'), project),
        isTrue,
      );
      expect(
        callbackMatchesProject(
          callback('https://development.example/auth/v1'),
          project,
        ),
        isFalse,
      );
      expect(
        callbackMatchesProject(
          Uri.parse('tharwati://auth-callback#access_token=broken'),
          project,
        ),
        isFalse,
      );
      expect(
        callbackMatchesProject(_pkceCallback('selected-environment'), project),
        isTrue,
      );
      expect(
        SharedPreferencesRecoveryMarkerStore('development', project).key,
        isNot(SharedPreferencesRecoveryMarkerStore('production', project).key),
      );
    },
  );
}

Uri _pkceCallback(String code) =>
    Uri.parse('tharwati://auth-callback?code=${code.padRight(16, 'x')}');

class _FakeRecoveryAuth implements RecoveryAuthClient {
  @override
  bool hasRecoveryOrigin = false;
  final _events = StreamController<AuthChangeEvent>.broadcast(sync: true);
  Future<bool> Function(Uri uri)? exchange;
  int exchanges = 0;
  int cleanups = 0;
  bool validSession = true;
  bool failCleanup = false;

  @override
  Stream<AuthChangeEvent> get authEvents => _events.stream;

  @override
  Future<bool> validateRecoverySession() async => validSession;

  @override
  Future<void> clearRecoverySession() async {
    cleanups++;
    if (failCleanup) throw StateError('offline');
  }

  @override
  Future<bool> exchangeAuthCallback(Uri uri) async {
    exchanges++;
    return await exchange?.call(uri) ?? false;
  }

  void emit(AuthChangeEvent event) => _events.add(event);

  Future<void> dispose() => _events.close();
}
