import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:tharwati_mobile/auth/auth_recovery_coordinator.dart';

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

  test('completion is one-shot and a reused link is ignored', () async {
    final uri = _pkceCallback('one-shot');
    auth.exchange = (_) async => true;
    await coordinator.start(initialUri: uri, linkStream: links.stream);

    coordinator.complete();
    links.add(uri);
    await Future<void>.delayed(Duration.zero);

    expect(coordinator.isActive, isFalse);
    expect(auth.exchanges, 1);
  });

  test('cancellation clears active recovery state', () async {
    auth.exchange = (_) async => true;
    await coordinator.start(
      initialUri: _pkceCallback('cancelled'),
      linkStream: links.stream,
    );

    coordinator.cancel();

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
}

Uri _pkceCallback(String code) =>
    Uri.parse('tharwati://auth-callback?code=${code.padRight(16, 'x')}');

class _FakeRecoveryAuth implements RecoveryAuthClient {
  final _events = StreamController<AuthChangeEvent>.broadcast(sync: true);
  Future<bool> Function(Uri uri)? exchange;
  int exchanges = 0;

  @override
  Stream<AuthChangeEvent> get authEvents => _events.stream;

  @override
  Future<bool> exchangeAuthCallback(Uri uri) async {
    exchanges++;
    return await exchange?.call(uri) ?? false;
  }

  void emit(AuthChangeEvent event) => _events.add(event);

  Future<void> dispose() => _events.close();
}
