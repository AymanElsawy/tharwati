import 'package:supabase_flutter/supabase_flutter.dart';

abstract interface class SettingsProfileStore {
  Future<String?> loadFullName();
  Future<String?> updateFullName(String value);
}

/// Canonical profile identity lives in `public.profiles`, rather than Auth
/// metadata. RLS constrains both operations to the current user's row.
class SettingsProfileRepository implements SettingsProfileStore {
  SettingsProfileRepository([SupabaseClient? client])
    : _client = client ?? Supabase.instance.client;

  final SupabaseClient _client;

  @override
  Future<String?> loadFullName() async {
    final row = await _client
        .from('profiles')
        .select('full_name')
        .eq('id', _currentUserId)
        .single();
    return normalizeFullName(row['full_name'] as String?);
  }

  @override
  Future<String?> updateFullName(String value) async {
    final fullName = normalizeFullName(value);
    final row = await _client
        .from('profiles')
        .update({'full_name': fullName})
        .eq('id', _currentUserId)
        .select('full_name')
        .single();
    return normalizeFullName(row['full_name'] as String?);
  }

  String get _currentUserId {
    final user = _client.auth.currentUser;
    if (user == null) throw StateError('No authenticated user.');
    return user.id;
  }
}

/// Matches web Settings: whitespace is trimmed and a blank name is stored as
/// null. There is intentionally no additional client-side name validation.
String? normalizeFullName(String? value) {
  final trimmed = value?.trim();
  return trimmed == null || trimmed.isEmpty ? null : trimmed;
}
