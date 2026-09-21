# Tharwati Mobile

Flutter (iOS + Android) client. **Auth only** for now — email + password via Supabase Auth, mirroring `../docs/auth.md`.

## Setup

- `flutter pub get`
- `flutter run` (device or simulator)
- The Supabase URL defaults to the linked project. Supply its public publishable
  key at build or run time with `--dart-define=SUPABASE_PUBLISHABLE_KEY=...`;
  `--dart-define=SUPABASE_URL=...` can select another project. Never use a secret key.

## Required Supabase dashboard config

Add the app deep link to **Auth → URL Configuration → Redirect URLs**:

```
tharwati://auth-callback
```

Both the **password-recovery** email and the **signup confirmation** email
(`emailRedirectTo` / `redirectTo`) return to this URL so the app — not the web
Site URL — handles them. Without it those links are rejected or bounce to the web
app (docs/auth.md audit F4). The scheme is registered natively in
`android/app/src/main/AndroidManifest.xml` and `ios/Runner/Info.plist`.

If **Confirm email** is off (the documented default), signup returns a session
immediately and no email/redirect is involved.

## What is implemented

- `lib/auth/auth_service.dart` — thin wrapper over `supabase.auth` (signUp / signIn / signOut / requestPasswordReset / updatePassword) + `getOnboardingCompletion()`.
- `lib/auth/auth_gate.dart` — signed out -> login; signed in -> onboarding or home based on `profiles.onboarding_completed`.
- Screens: login, signup, forgot-password, reset-password (shared `auth_scaffold.dart`).
- Password rule (signup + reset): 12+ chars, one upper, one lower, one digit (`password_policy.dart`, tested).
- `PASSWORD_RECOVERY` deep link opens the reset screen over the whole app (`main.dart`).
- Signup confirmation email links back to `tharwati://auth-callback`; supabase_flutter
  establishes the session on the incoming link and `AuthGate` routes to onboarding.

Home and onboarding are placeholders — feature tabs are out of scope here.
