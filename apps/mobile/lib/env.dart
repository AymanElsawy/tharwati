/// Supabase connection. The anon key is a public client credential (same one the
/// web app ships) — safe to embed. Override at build time with:
///   --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=...
class Env {
  static const supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://zpghalbnvcpaqjjtmgnq.supabase.co',
  );

  static const supabaseAnonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwZ2hhbGJudmNwYXFqanRtZ25xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NzI5MzIsImV4cCI6MjEwMjQ0ODkzMn0.6CEWIQhuWZX1mQTMRRyeLuG4lDnpbmzFxu7znxAskZY',
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
