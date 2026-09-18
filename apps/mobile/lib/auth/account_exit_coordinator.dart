import 'package:flutter/foundation.dart';

import '../settings/account_deletion_controller.dart';

class AccountExitCoordinator extends ChangeNotifier
    implements AccountDeletionExit {
  bool _forceSignedOut = false;

  bool get forceSignedOutActive => _forceSignedOut;

  @override
  void forceSignedOut() {
    if (_forceSignedOut) return;
    _forceSignedOut = true;
    notifyListeners();
  }

  void acceptFreshSignIn() {
    if (!_forceSignedOut) return;
    _forceSignedOut = false;
    notifyListeners();
  }
}

final accountExitCoordinator = AccountExitCoordinator();
