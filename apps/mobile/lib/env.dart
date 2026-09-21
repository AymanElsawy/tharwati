/// Supabase connection. Supply the public publishable key at build time:
///   --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_PUBLISHABLE_KEY=...
class Env {
  static const supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://zpghalbnvcpaqjjtmgnq.supabase.co',
  );

  static const supabasePublishableKey = String.fromEnvironment(
    'SUPABASE_PUBLISHABLE_KEY',
  );

  /// Custom-scheme deep link the Supabase auth emails return to, so the app —
  /// not the web app — handles them. Used for both the signup confirmation and
  /// the password-recovery email. Must be allow-listed in Supabase → Auth →
  /// URL Configuration → Redirect URLs, and is registered natively in
  /// android/app/src/main/AndroidManifest.xml and ios/Runner/Info.plist.
  static const authDeepLink = 'tharwati://auth-callback';

  /// Back-compat alias.
  static const passwordResetRedirect = authDeepLink;
}
