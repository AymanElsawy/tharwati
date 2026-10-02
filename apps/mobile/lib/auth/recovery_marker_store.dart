import 'package:shared_preferences/shared_preferences.dart';

abstract interface class RecoveryMarkerStore {
  Future<String?> read();
  Future<void> write(String? phase);
}

/// Contains only a lifecycle phase, never a URI, password, or token.
class SharedPreferencesRecoveryMarkerStore implements RecoveryMarkerStore {
  SharedPreferencesRecoveryMarkerStore(String environment, String projectUrl)
    : key = 'tharwati-recovery-v1:$environment:${Uri.parse(projectUrl).origin}';

  final String key;
  SharedPreferencesAsync? _preferencesValue;
  SharedPreferencesAsync get _preferences =>
      _preferencesValue ??= SharedPreferencesAsync();

  @override
  Future<String?> read() => _preferences.getString(key);

  @override
  Future<void> write(String? phase) async {
    if (phase == null) {
      await _preferences.remove(key);
    } else {
      await _preferences.setString(key, phase);
    }
  }
}

/// Explicit test/in-memory implementation; production always injects persistence.
class MemoryRecoveryMarkerStore implements RecoveryMarkerStore {
  String? phase;
  @override
  Future<String?> read() async => phase;
  @override
  Future<void> write(String? value) async => phase = value;
}
