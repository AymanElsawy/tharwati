import 'package:supabase_flutter/supabase_flutter.dart';

import '../env.dart';

/// Thin wrapper over `supabase.auth`, mirroring the web app's auth.service.ts
/// (docs/auth.md). Email + password only — no OAuth, MFA, or phone.
class AuthService {
  AuthService(this._client);

  final SupabaseClient _client;

  GoTrueClient get _auth => _client.auth;

  Session? get currentSession => _auth.currentSession;
  User? get currentUser => _auth.currentUser;

  Stream<AuthState> get onAuthStateChange => _auth.onAuthStateChange;

  /// [fullName] is stashed in user metadata as `full_name`; the
  /// `handle_new_user` trigger copies it onto the fresh `profiles` row. Mobile
  /// collects the name here (not in onboarding), matching the web signup.
  Future<AuthResponse> signUp(
    String email,
    String password, {
    String? fullName,
  }) => _auth.signUp(
    email: email,
    password: password,
    // If email confirmation is on, the confirm link returns to the app via this
    // custom scheme instead of the web Site URL; supabase_flutter parses the
    // tokens on the incoming link and fires a signedIn event that AuthGate acts
    // on. Harmless when confirmation is off — signup just returns a session.
    emailRedirectTo: Env.authDeepLink,
    data: (fullName != null && fullName.trim().isNotEmpty)
        ? {'full_name': fullName.trim()}
        : null,
  );

  Future<AuthResponse> signIn(String email, String password) =>
      _auth.signInWithPassword(email: email, password: password);

  Future<void> signOut() => _auth.signOut();

  Future<void> requestPasswordReset(String email) =>
      _auth.resetPasswordForEmail(email, redirectTo: Env.passwordResetRedirect);

  Future<UserResponse> updatePassword(String newPassword) =>
      _auth.updateUser(UserAttributes(password: newPassword));

  /// Full name from signup metadata, if any — used for the onboarding greeting.
  String? get currentFullName {
    final value = currentUser?.userMetadata?['full_name'];
    return (value is String && value.trim().isNotEmpty) ? value.trim() : null;
  }

  /// Persists the onboarding answers and flips `onboarding_completed`, via the
  /// same `complete_onboarding` RPC the web app uses
  /// (`p_country_code`, `p_base_currency_code`, `p_selected_goals`). All three
  /// are required; the RPC derives the target row from `auth.uid()`.
  Future<void> completeOnboarding({
    required String countryCode,
    required String baseCurrencyCode,
    required List<String> selectedGoals,
  }) async {
    await _client.rpc(
      'complete_onboarding',
      params: {
        'p_country_code': countryCode,
        'p_base_currency_code': baseCurrencyCode,
        'p_selected_goals': selectedGoals,
      },
    );
  }

  /// Reads `profiles.onboarding_completed` for the signed-in user. The row is
  /// created by the `handle_new_user` trigger; RLS scopes it to the caller.
  /// Throws on transport/RLS failure so the gate can show a retry screen.
  Future<bool> getOnboardingCompletion() async {
    final row = await _client
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', currentUser!.id)
        .single()
        .timeout(
          const Duration(seconds: 15),
          onTimeout: () => throw Exception(
            'Timed out reaching the server. Check your connection.',
          ),
        );
    return row['onboarding_completed'] as bool? ?? false;
  }
}
