# Authentication

## Purpose and scope

Email + password authentication backed entirely by Supabase Auth (GoTrue). There is
no custom credential storage, no OAuth/social provider, no MFA, and no phone/SMS.
The client never sees or stores passwords beyond the moment it hands them to
`supabase.auth.*`. Every feature tab is gated behind an authenticated session; the
real data boundary is Postgres RLS, and the client-side route guard is a UX
convenience on top of it.

`profiles` is the only application table in the auth path. It is bootstrapped by a
`SECURITY DEFINER` trigger on `auth.users` insert and carries the onboarding gate.

## Data model

No app-owned auth tables. Identities, sessions, refresh tokens, and recovery tokens
live in Supabase's `auth` schema.

`public.profiles` — one row per user, `id` is a FK to `auth.users(id)` `on delete
cascade`. Relevant columns: `onboarding_completed boolean not null default true` (set
to `false` by the current `handle_new_user` trigger so new users enter onboarding),
`full_name`, `avatar_url`, `country_code`, `base_currency_code`, `selected_goals`.
RLS exposes `select` and `update` of the caller's own row only; there is **no**
`insert` policy — the row is created exclusively by the `handle_new_user` trigger,
which also backfills any pre-existing `auth.users` row.

Session tokens: `jwt_expiry = 3600`s, refresh-token rotation enabled,
`refresh_token_reuse_interval = 10`s. The browser client uses supabase-js defaults —
session persisted in `localStorage`, `autoRefreshToken` on, `detectSessionInUrl` on.

## Session lifecycle

`src/app/App.tsx` owns session state:

- On mount it reads `supabase.auth.getSession()`, then subscribes to
  `supabase.auth.onAuthStateChange`.
- `resolveSession(session)` stores the session, then (if signed in) reads
  `profiles.onboarding_completed` via `getOnboardingCompletion()`. A failure here
  shows a generic "We couldn't load your account" retry screen; the underlying error
  is logged to the console, never rendered.
- `canPreserveAuthenticatedTree(currentUserId, nextSession)`
  (`auth-session-lifecycle.ts`) returns `true` when a state change is just a token
  refresh for the **same** user id, so the mounted authenticated tree is kept
  instead of being torn down and rebuilt.
- `PASSWORD_RECOVERY` events, and any initial load whose URL hash contains
  `type=recovery`, flip an `isPasswordRecovery` flag that renders the reset screen
  over the entire router (see below).

## Sign up / sign in / sign out

`src/features/auth/auth.service.ts` is the thin wrapper over `supabase.auth`:

| Function | Call | Notes |
|---|---|---|
| `signUp(email, password)` | `auth.signUp` | Returns `{ user, session }`. |
| `signIn(email, password)` | `auth.signInWithPassword` | On success the login page navigates to `/dashboard`. |
| `signOut()` | `auth.signOut` | Global scope (default). Called from the dashboard header logout and, internally, at the end of a password recovery. |
| `requestPasswordReset(email)` | `auth.resetPasswordForEmail` | `redirectTo: ${window.location.origin}/reset-password`. |
| `updatePassword(newPassword)` | `auth.updateUser({ password })` | Only meaningful while a recovery session is active. |

`SignUpPage`: on `signUp` success, if a `session` is returned it navigates to
`/onboarding`; otherwise it shows "Check your email to confirm your account". With
the current project setting `enable_confirmations = false`, signup always returns a
session, so the confirm-email branch is currently unreachable.

`DashboardLayout.handleLogout` calls `signOut()` then `navigate("/login", { replace:
true })`; a failure is logged, not surfaced.

## Password reset (recovery flow)

1. **Request** — `/forgot-password` (`ForgotPasswordPage`). One email field →
   `requestPasswordReset(email)`. The screen always shows the same neutral "If an
   account exists for … a reset link is on its way" message regardless of whether the
   address is registered (no account enumeration). A transport failure shows a
   generic retry message; the real error is logged.
2. **Email link** — Supabase sends the recovery email; the link returns the user to
   `${origin}/reset-password#…type=recovery…`.
3. **Recovery gate** — `App.tsx` detects the `/reset-password` path synchronously on
   first render, but keeps the reset form hidden while Supabase
   processes the link. Only a `PASSWORD_RECOVERY` event carrying a session marks
   the recovery session valid and enables the form. If startup finishes without
   that confirmation, the page shows an invalid/expired-link state with an action
   to request a new link. The recovery screen remains outside the router, so its
   session cannot enter the authenticated app.
4. **Set new password** — `ResetPasswordPage`: `New password` + `Confirm password`.
   Client rules: minimum 8 characters, both fields must match. On submit →
   `updatePassword(newPassword)`, then `signOut()` (best-effort) to drop the recovery
   session, then a success state whose button sends the user to `/login` to sign in
   with the new password. `weak_password` preserves Supabase's password-policy
   message; `AuthSessionMissingError` asks for a new reset link; other failures show
   a generic retry message.

A plain or expired `/reset-password` route receives no recovery confirmation and
shows the invalid/expired-link state.

`/login`, `/signup`, and `/forgot-password` all redirect an already-authenticated
user to their post-auth destination (`/dashboard` or `/onboarding`).

## Validation

- Email fields are `type="email"` `required`; no additional client format check.
- Login/signup password field: `required`; signup adds `minLength={6}` to match the
  server's `minimum_password_length = 6`.
- Reset password: `minLength={8}` and an equality check against the confirm field —
  intentionally stricter than the current server minimum (see quirks).
- Server-side password strength (`password_requirements`), leaked-password
  protection, email confirmation, and CAPTCHA are Supabase-dashboard settings, not
  code. As of the launch-readiness audit they are **off** (see
  `plans/launch-readiness-security-audit.md`, F3).

## Security and API

- All application data access requires an authenticated session; `anon` has no
  table grants and no policy grants anything to `anon`/`public` (post-audit
  migration `20260831145907_lock_down_anon_and_authenticated_grants.sql`).
- `handle_new_user()` is `SECURITY DEFINER` with a fixed empty `search_path`, is
  revoked from `public`/`anon`/`authenticated`, and runs only as the
  `on_auth_user_created` trigger. It is the only writer of `profiles` rows.
- `profiles` cascade-deletes with its `auth.users` row.
- Password reset redirect targets must be allow-listed in the hosted project's
  **Auth → URL configuration** (Site URL + Redirect URLs) for the production
  domain; otherwise `resetPasswordForEmail` links resolve to the wrong origin or
  are rejected (audit F4).
- Client startup and auth errors are logged to the console and shown to the user
  only as generic copy — raw backend messages are not rendered (audit F5, partial).

## UI

Public routes: `/login`, `/signup`, `/forgot-password`, `/reset-password`. All four
auth screens share one visual pattern — a centered `tharwati-card` with a soft radial
background, an `email`/`password` input style with focus ring, a full-width primary
`Button`, an inline `role="alert"` error box, and a secondary text button to cross-
navigate (login ⇄ signup, forgot ⇄ login). The login screen adds a "Forgot
password?" text button beside the password label. Screens are responsive; the reset
success and forgot-sent states swap the form body for a status message plus a single
onward action.

## i18n / RTL

Most auth-screen copy remains hardcoded English. The login screen's "Forgot
password?" entry point and generic login-failure message use
`src/i18n/{en,ar}/translations.ts`; the action follows document direction, so it
appears on the logical opposite side of the password label in Arabic without
changing navigation. The remaining auth copy still needs full internationalization.

## Deferred / known gaps

- No email verification, CAPTCHA, leaked-password check, or password-complexity
  rules enabled (hosted-dashboard config — audit F3).
- Auth copy is not internationalized.
- Client-side reset minimum (8) is stricter than the server minimum (6); align both.
- No account-deletion self-service; user deletion is a Supabase admin/API action.
- No social login, MFA, magic-link, or "remember this device".
