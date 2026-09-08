import 'package:flutter/foundation.dart';

/// App-wide "something changed" signal — the mobile stand-in for the web's
/// `window` `tharwati:data-changed` DOM event (docs/dashboard.md §2.9).
///
/// Feature code calls [DataChange.instance.ping] after any mutation (account
/// edit, transaction, goal entry, exchange-rate change…). Screens that show
/// derived data (the Dashboard) listen and silently refresh.
class DataChange extends ChangeNotifier {
  DataChange._();

  static final DataChange instance = DataChange._();

  /// Broadcast that user data changed somewhere in the app.
  void ping() => notifyListeners();
}
