import 'dart:convert';

import 'package:supabase_flutter/supabase_flutter.dart';

import '../env.dart';
import '../core/read_deadline.dart';
import 'auth_recovery_coordinator.dart';

/// Thin wrapper over `supabase.auth`, mirroring the web app's auth.service.ts
/// (docs/auth.md). Email + password only — no OAuth, MFA, or phone.
class AuthService implements RecoveryAuthClient {
  AuthService(this._client, {String? projectUrl})
    : _projectUrl = projectUrl ?? Env.supabaseUrl;

  final String _projectUrl;
  Future<void> Function()? onNormalSession;

  final SupabaseClient _client;

  GoTrueClient get _auth => _client.auth;

  Session? get currentSession => _auth.currentSession;
  User? get currentUser => _auth.currentUser;

  Stream<AuthState> get onAuthStateChange => _auth.onAuthStateChange;

  @override
  Stream<AuthChangeEvent> get authEvents =>
      _auth.onAuthStateChange.map((state) => state.event);

  @override
  bool get hasRecoveryOrigin =>
      sessionHasRecoveryOrigin(_auth.currentSession?.accessToken);

  @override
  Future<bool> exchangeAuthCallback(Uri uri) async {
    // Issuer is an early rejection guard; the selected SDK still authenticates.
    if (!callbackMatchesProject(uri, _projectUrl)) {
      throw const FormatException('Callback belongs to another environment.');
    }
    final response = await _auth.getSessionFromUrl(uri);
    return sessionHasRecoveryOrigin(response.session.accessToken) ||
        response.redirectType == 'recovery' ||
        response.redirectType == AuthChangeEvent.passwordRecovery.name;
  }

  @override
  Future<bool> validateRecoverySession() async {
    if (_auth.currentSession == null) return false;
    final user = (await _auth.getUser()).user;
    return user != null && user.id == _auth.currentUser?.id;
  }

  @override
  Future<void> clearRecoverySession() =>
      _auth.signOut(scope: SignOutScope.local);

  /// [fullName] is stashed in user metadata as `full_name`; the
  /// `handle_new_user` trigger copies it onto the fresh `profiles` row. Mobile
  /// collects the name here (not in onboarding), matching the web signup.
  Future<AuthResponse> signUp(
    String email,
    String password, {
    String? fullName,
  }) async {
    final response = await _auth.signUp(
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
    if (response.session != null) await onNormalSession?.call();
    return response;
  }

  Future<AuthResponse> signIn(String email, String password) async {
    final response = await _auth.signInWithPassword(
      email: email,
      password: password,
    );
    await onNormalSession?.call();
    return response;
  }

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
    final row = await readWithDeadline(
      const Duration(seconds: 15),
      (abort) => _client
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', currentUser!.id)
          .single()
          .abortSignal(abort),
    );
    return row['onboarding_completed'] as bool? ?? false;
  }
}

/// PKCE codes are verified at the configured project; legacy tokens must match it.
bool callbackMatchesProject(Uri uri, String projectUrl) {
  final params = <String, String>{
    ...uri.queryParameters,
    ...Uri.splitQueryString(uri.fragment),
  };
  final token = params['access_token'];
  if (token == null) return true;
  try {
    final payload =
        jsonDecode(
              utf8.decode(
                base64Url.decode(base64Url.normalize(token.split('.')[1])),
              ),
            )
            as Map<String, dynamic>;
    return payload['iss'] ==
        '${projectUrl.replaceFirst(RegExp(r'/$'), '')}/auth/v1';
  } catch (_) {
    return false;
  }
}

/// This untrusted claim can only restrict routing, never grant authentication.
bool sessionHasRecoveryOrigin(String? token) {
  try {
    final payload =
        jsonDecode(
              utf8.decode(
                base64Url.decode(base64Url.normalize(token!.split('.')[1])),
              ),
            )
            as Map<String, dynamic>;
    final amr = payload['amr'];
    return amr is List &&
        amr.any((entry) => entry is Map && entry['method'] == 'recovery');
  } catch (_) {
    return false;
  }
}
