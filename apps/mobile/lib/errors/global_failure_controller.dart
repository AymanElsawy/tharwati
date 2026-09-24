import 'package:flutter/foundation.dart';

class GlobalFailureController extends ChangeNotifier {
  bool _fatal = false;

  bool get hasFatalFailure => _fatal;

  void reportFatal() {
    if (_fatal) return;
    _fatal = true;
    notifyListeners();
  }

  void retry() {
    if (!_fatal) return;
    _fatal = false;
    notifyListeners();
  }
}
