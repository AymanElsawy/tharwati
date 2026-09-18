import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/settings/account_deletion_controller.dart';

void main() {
  const email = 'investor@example.com';

  test(
    'successful deletion forces signed-out state and cleans local session',
    () async {
      final gateway = _FakeGateway();
      final exit = _FakeExit();
      final controller = _controller(gateway, exit);

      await _reachConfirmation(controller);
      controller.setConfirmation(email);
      await controller.permanentlyDelete();

      expect(gateway.deleteCalls, 1);
      expect(gateway.deletedPassword, 'correct-password');
      expect(gateway.cleanupCalls, 1);
      expect(exit.calls, 1);
      expect(controller.step, AccountDeletionStep.completed);
    },
  );

  test('wrong password stays in flow with a distinct error', () async {
    final gateway = _FakeGateway(
      reauthFailure: AccountDeletionFailure.reauthenticationFailed,
    );
    final controller = _controller(gateway, _FakeExit())..setPassword('wrong');

    await controller.submitPassword();

    expect(controller.step, AccountDeletionStep.password);
    expect(controller.failure, AccountDeletionFailure.reauthenticationFailed);
    expect(controller.canConfirmEmail, isFalse);
  });

  test('expired session forces Login state', () async {
    final gateway = _FakeGateway(
      reauthFailure: AccountDeletionFailure.unauthenticated,
    );
    final exit = _FakeExit();
    final controller = _controller(gateway, exit)..setPassword('password');

    await controller.submitPassword();

    expect(exit.calls, 1);
    expect(gateway.cleanupCalls, 1);
    expect(controller.failure, AccountDeletionFailure.unauthenticated);
  });

  for (final failure in [
    AccountDeletionFailure.deletionFailed,
    AccountDeletionFailure.uncertain,
  ]) {
    test('$failure never claims deletion success', () async {
      final gateway = _FakeGateway(deleteFailure: failure);
      final exit = _FakeExit();
      final controller = _controller(gateway, exit);
      await _reachConfirmation(controller);
      controller.setConfirmation(email);

      await controller.permanentlyDelete();

      expect(controller.step, AccountDeletionStep.password);
      expect(controller.failure, failure);
      expect(exit.calls, 0);
      expect(gateway.cleanupCalls, 0);
    });
  }

  test(
    'lost response recovered as user_not_found completes successfully',
    () async {
      final gateway = _FakeGateway(recoveredAfterLostResponse: true);
      final exit = _FakeExit();
      final controller = _controller(gateway, exit);
      await _reachConfirmation(controller);
      controller.setConfirmation(email);

      await controller.permanentlyDelete();

      expect(controller.step, AccountDeletionStep.completed);
      expect(exit.calls, 1);
    },
  );

  test('duplicate destructive submission sends one request', () async {
    final pending = Completer<void>();
    final gateway = _FakeGateway(deletePending: pending);
    final controller = _controller(gateway, _FakeExit());
    await _reachConfirmation(controller);
    controller.setConfirmation(email);

    final first = controller.permanentlyDelete();
    final second = controller.permanentlyDelete();
    expect(gateway.deleteCalls, 1);
    pending.complete();
    await Future.wait([first, second]);
  });

  test('request body contains only password', () {
    expect(deleteAccountRequestBody('secret'), {'password': 'secret'});
  });

  test(
    'exact email is required and cancellation clears sensitive state',
    () async {
      final gateway = _FakeGateway();
      final controller = _controller(gateway, _FakeExit());
      await _reachConfirmation(controller);

      controller.setConfirmation('INVESTOR@example.com');
      expect(controller.canConfirmEmail, isFalse);
      controller.setConfirmation(email);
      expect(controller.canConfirmEmail, isTrue);
      controller.cancel();
      controller.open();
      controller.setConfirmation(email);
      expect(controller.canConfirmEmail, isFalse);
      await controller.submitPassword();
      expect(gateway.reauthCalls, 1);
    },
  );

  test('cleanup failure cannot reverse confirmed server deletion', () async {
    final gateway = _FakeGateway(cleanupFails: true);
    final exit = _FakeExit();
    final controller = _controller(gateway, exit);
    await _reachConfirmation(controller);
    controller.setConfirmation(email);

    await controller.permanentlyDelete();

    expect(controller.step, AccountDeletionStep.completed);
    expect(exit.calls, 1);
    expect(controller.failure, isNull);
  });
}

AccountDeletionController _controller(_FakeGateway gateway, _FakeExit exit) =>
    AccountDeletionController(
      gateway: gateway,
      exit: exit,
      email: 'investor@example.com',
    )..open();

Future<void> _reachConfirmation(AccountDeletionController controller) async {
  controller.setPassword('correct-password');
  await controller.submitPassword();
  expect(controller.step, AccountDeletionStep.confirmation);
}

class _FakeExit implements AccountDeletionExit {
  int calls = 0;

  @override
  void forceSignedOut() => calls++;
}

class _FakeGateway implements AccountDeletionGateway {
  _FakeGateway({
    this.reauthFailure,
    this.deleteFailure,
    this.recoveredAfterLostResponse = false,
    this.deletePending,
    this.cleanupFails = false,
  });

  final AccountDeletionFailure? reauthFailure;
  final AccountDeletionFailure? deleteFailure;
  final bool recoveredAfterLostResponse;
  final Completer<void>? deletePending;
  final bool cleanupFails;
  int reauthCalls = 0;
  int deleteCalls = 0;
  int cleanupCalls = 0;
  String? deletedPassword;

  @override
  Future<void> reauthenticate(String password) async {
    reauthCalls++;
    if (reauthFailure != null) throw AccountDeletionException(reauthFailure!);
  }

  @override
  Future<void> deleteCurrentAccount(String password) async {
    deleteCalls++;
    deletedPassword = password;
    await deletePending?.future;
    if (deleteFailure != null) throw AccountDeletionException(deleteFailure!);
    if (recoveredAfterLostResponse) return;
  }

  @override
  Future<void> clearLocalSession() async {
    cleanupCalls++;
    if (cleanupFails) throw Exception('cleanup failed');
  }
}
