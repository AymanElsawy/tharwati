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

Session policy is configured in hosted Supabase. Local configuration and historical
policy assertions are not production evidence. The Web SDK owns session persistence
and refresh; S4-B adds only a project-scoped recovery-phase marker in localStorage.

## Session lifecycle

`apps/web/src/app/App.tsx` owns normal session/onboarding routing. The
`RecoveryLifecycle` instance is constructed before the Supabase client, writes
incoming recovery isolation before URL processing, and subscribes to Auth before
React mounts. It renders recovery outside the router whenever the phase is
checking, valid, or invalid. It also suppresses restored sessions in the ended
phase, so completion/cancellation cannot fall back to Dashboard if cleanup fails.

Normal sessions still read `profiles.onboarding_completed`, preserve the mounted
authenticated tree on same-user refresh, and show generic startup/account failures.
A recovery-origin `amr` claim can reconstruct a missing older marker; decoding
only restricts routing. Supabase `getUser()` against the selected project validates
a restored session before it can enable password reset.

## Sign up / sign in / sign out

`src/features/auth/auth.service.ts` is the thin wrapper over `supabase.auth`:

| Function | Call | Notes |
|---|---|---|
| `signUp(email, password)` | `auth.signUp` | Returns `{ user, session }`. |
| `signIn(email, password)` | `auth.signInWithPassword` | On success the login page navigates to `/dashboard`. |
| `signOut()` | `auth.signOut` | Global scope (default) for ordinary logout. Recovery exit separately uses local scope. |
| `requestPasswordReset(email)` | `auth.resetPasswordForEmail` | `redirectTo: ${window.location.origin}/reset-password`. |
| `updatePassword(newPassword)` | `auth.updateUser({ password })` | Only meaningful while a recovery session is active. |

`SignUpPage`: on `signUp` success, if a `session` is returned it navigates to
`/onboarding`; otherwise it shows "Check your email to confirm your account". With
the current project setting `enable_confirmations = false`, signup always returns a
session, so the confirm-email branch is currently unreachable.

`DashboardLayout.handleLogout` calls `signOut()` then `navigate("/login", { replace:
true })`; a failure is logged, not surfaced.

## Password reset (recovery flow)

1. **Request** - `/forgot-password` submits a trimmed email through the Supabase
   SDK, using `${window.location.origin}/reset-password`. Success copy remains
   neutral; failures show a generic retry message.
2. **Incoming callback** - a non-secret `checking` phase is persisted before the
   client can process an incoming recovery link. A validated `PASSWORD_RECOVERY`
   event records `active`; startup events cannot release the recovery gate.
   Wrong-project legacy token issuers are rejected before URL detection; the SDK
   still authenticates the callback. The existing SDK flow type is preserved.
3. **Reload/navigation** - the marker is keyed by project origin and survives
   changing paths or restarting the browser. An `active` marker plus a session
   validated by `getUser()` reopens the reset form, including at `/`. Interrupted,
   missing, expired, or invalid sessions show an explicit EN/AR invalid-link state
   with request-new-link and cancellation actions. A new erroneous callback does
   not reuse a previous valid recovery state.
4. **Update** - Signup and Reset retain the same 12-character, lowercase,
   uppercase, and digit rules. Password update success invokes recovery exit
   immediately and returns to Login. Cleanup failure is not a password failure.
5. **Exit** - completion, cancellation, and request-new-link persist `ended`
   before best-effort local-scope sign-out. The ended marker continues to suppress
   any leftover SDK session across navigation/restart until an explicit successful
   password sign-in or signup replaces it. The new-link action opens the normal
   forgot-password route only after recovery cleanup.

Persistence stores only `checking`, `active`, or `ended`; no password, token,
callback URI, or code is added to persistence. Marker storage failure fails closed.
The marker is a client routing safeguard, not an extra server authorization model:
Supabase remains the only Auth system and RLS remains the data boundary.

## Validation

- Email fields are `type="email"` `required`; no additional client format check.
- Signup and Reset Password both require at least 12 characters, at least one
  lowercase letter, at least one uppercase letter, and at least one number. They
  share the same client predicate, visible localized helper, and localized
  weak-password error treatment. Hosted password enforcement remains a separate verification requirement.
- Server-side password strength (`password_requirements`), leaked-password
  protection, email confirmation, and CAPTCHA are Supabase-dashboard settings, not
  code. The client does not expose raw backend policy text.

## Security and API

- All application data access requires an authenticated session; `anon` has no
  table grants and no policy grants anything to `anon`/`public` (post-audit
  migration `20260831145907_lock_down_anon_and_authenticated_grants.sql`).
- `handle_new_user()` is `SECURITY DEFINER` with a fixed empty `search_path`, is
  revoked from `public`/`anon`/`authenticated`, and runs only as the
  `on_auth_user_created` trigger. It is the only writer of `profiles` rows.
- Whole-user deletion starts from `auth.users` and cascades through every
  user-owned domain, including profiles, settings, accounts, immutable ledger
  history, assets/holdings, manual prices, valuations/disposals, Gold/Silver
  lifecycle history, dashboard snapshots, and Goals/progress. Posted ledger
  rows remain immutable while their Auth owner exists; their delete triggers
  permit deletion only after the parent Auth row has entered its database
  cascade. Internal history cross-links use deferred referential checks so the
  complete cascade can finish without weakening standalone delete protection.
- Password reset redirect targets must be allow-listed in the hosted project's
  **Auth → URL configuration** (Site URL + Redirect URLs) for the production
  domain; otherwise `resetPasswordForEmail` links resolve to the wrong origin or
  are rejected (audit F4).
- Client startup and auth errors are logged to the console and shown to the user
  only as generic copy — weak-password messages on Signup and Reset Password are
  localized and raw backend text is not rendered.

### Download My Data backend

Privacy Stage 2 exposes an authenticated, versioned JSON export through the
protected `/settings` page. The `export-my-data` Edge Function validates the bearer session with
Supabase Auth and calls `export_my_data_v1()` using that same caller-scoped client.
The function never uses a service-role key for table fan-out. The RPC takes no
arguments and derives ownership exclusively from `auth.uid()`.

The document contract is `schema: "tharwati.user-data-export"`, `version: 1`, with
`generated_at`, the authenticated subject id, a safe Auth-account subset (`id`,
`email`, `phone`, account timestamps), and explicitly selected source/audit rows:
profile/preferences, financial accounts, transactions and entries, holdings,
user-created assets and identifiers, Gold/Silver purchases and lifecycle events,
valuations and disposals, user-created categories and personal category overrides,
Goals and progress entries, and caller-owned manual market prices. Numeric money
and quantity fields are JSON strings and every collection has a stable database
ordering.

The export excludes credentials and tokens, Auth identities and metadata blobs,
shared catalogs/assets, global provider price caches, dashboard valuation
snapshots, logs, operational rate-limit state, and newly calculated/derived
financial metrics. Stored stale or unavailable source records are exported as
stored; the export does not refresh providers or fabricate values.

The database enforces one export request per authenticated user per 60 seconds
with an atomic rate-limit claim. The Edge Function caps the serialized response at
10 MiB and returns `export_too_large` with HTTP 413 rather than truncating. Success
uses `application/json`, `Cache-Control: no-store`, and attachment name
`tharwati-data-export-v1-YYYY-MM-DD.json`; no copy is written to Storage and export
bodies or financial values are not logged. `public` and `anon` cannot execute the
RPC; only `authenticated` receives `EXECUTE`.

## UI

Public routes: `/login`, `/signup`, `/forgot-password`, `/reset-password`. All four
auth screens share one visual pattern — a centered `tharwati-card` with a soft radial
background, an `email`/`password` input style with focus ring, a full-width primary
`Button`, an inline `role="alert"` error box, and a secondary text button to cross-
navigate (login ⇄ signup, forgot ⇄ login). The login screen adds a "Forgot
password?" text button beside the password label. Screens are responsive; the reset
success and forgot-sent states swap the form body for a status message plus a single
onward action.

### Mobile (Flutter) — Flow 1

`tharwati_mobile/` implements the design canvas's **Flow 1 — Auth & onboarding**
(Claude Design project `2634f553-bee9-4e9f-90a7-3c1898dac2d0`, file
`Tharwati Mobile.dc.html`). The auth logic is unchanged from the web mirror
(`AuthService` wraps `supabase.auth`); only presentation and the onboarding
screens are new.

- **Tokens** — `lib/theme/tokens.dart` (light + dark palettes from the Style
  tile: accent `#15694A` / dark `#3E9E77`, canvas, surface, ink, ink-muted,
  negative, amber `metal`, line; radius field 12 / button 16 / card 22; field &
  button height 52, min touch 44) registered as a `ThemeExtension` by
  `lib/theme/app_theme.dart`. Type family Plus Jakarta Sans + IBM Plex Sans
  Arabic fallback via `google_fonts`. `MaterialApp` runs `ThemeMode.system`.
- **Shared widgets** — `lib/widgets/`: `PrimaryButton`/`SecondaryButton`/
  `GhostButton`, `TharwatiTextField` (label + focus ring + show/hide eye),
  `Callout` (info / success / warning / danger advisory box), `BrandMark`,
  `PasswordStrengthBar`, `StepDots`.
- **Auth screens** — `auth_scaffold.dart` is the canvas-ground phone layout
  (optional back chevron, brand header slot, left-aligned title + subtitle,
  bottom-pinned footer, error as a danger `Callout`). Sign in adds the brand
  mark and static العربية / EGP pills; Sign up adds full name, confirm password,
  a 4-segment strength meter, and a required Terms checkbox (name is sent as
  `full_name` user metadata); Forgot password and Reset password use the design
  copy, success/expired `Callout`s, and a live "Password rules" card.
- **Email deep link** - signup confirmation and recovery use the existing
  `tharwati://auth-callback`. Automatic SDK URI detection is disabled. Bootstrap
  validates the explicit environment first, captures the cold URI, initializes
  the selected Supabase client, and starts `AuthRecoveryCoordinator` before
  mounting the app. Strict scheme/host/path/port/user-info and PKCE code-shape
  validation is preserved. Legacy token issuers must match the configured project;
  PKCE exchange always uses that project's SDK and local verifier.
- **Mobile recovery lifecycle** - SharedPreferencesAsync stores only the phase,
  under an environment-and-project-origin key. `checking` is written before
  exchange; only successful exchanges are deduplicated. Transport failures allow
  an in-memory retry of the same URI. Restart restores active recovery only after
  project-side session validation, or shows explicit invalid-link feedback. A
  recovery-origin claim can reconstruct an older missing marker.
- **Mobile recovery UI/exit** - `RecoveryGate` is installed in MaterialApp.builder,
  above the ordinary Navigator. It replaces the conflicting route stack with a
  separate recovery Navigator/Overlay, so warm recovery is visible over Forgot
  Password and password editing works. Invalid and transport states provide EN/AR
  feedback, retry where available, request-new-link, and cancellation. Successful
  password update ends recovery automatically and returns to Login. Completion or
  cancellation records `ended` before best-effort local sign-out; only an explicit
  successful password login/signup releases the leftover-session guard.
- **Onboarding** — `lib/onboarding/`: `OnboardingFlow` runs the same 5 steps as
  the web (`Welcome → Country → Currency → Goals → Ready`). The name is captured
  at signup, not here. `steps/country_step.dart` is a searchable list over
  `data/countries.dart` (the web's ISO list, ported); picking a country
  preselects the base currency via `data/country_currency.dart` (ported verbatim
  from `src/features/onboarding/data/country-currency.ts`), clamped to the five
  supported codes in `data/currencies.dart` (USD, SAR, EGP, EUR, GBP, AED). UAE
  preselects AED through the shared country-to-currency mapping. Goal ids
  (`buy_home`, `buy_car`, `travel`, `education`, `other`) match `GoalsPage` so
  `selected_goals` reads identically on both platforms. Ready calls
  `AuthService.completeOnboarding(countryCode, baseCurrencyCode, selectedGoals)`,
  which invokes the **`complete_onboarding` RPC** (`p_country_code`,
  `p_base_currency_code`, `p_selected_goals`) — the same path as web. `AuthGate`
  re-reads `onboarding_completed` via the `onboardingRefresh` notifier and routes
  on to `HomePage`. The design canvas's simpler name + "saving toward" onboarding
  artboards (05–06) were intentionally not followed here — the web data model
  (country + base currency + goals) is the source of truth.

## i18n / RTL

Most auth-screen copy remains hardcoded English. Password requirements, password
validation, and weak-password copy on Signup and Reset Password, plus the login
screen's "Forgot password?" entry point and generic login-failure message, use
`src/i18n/{en,ar}/translations.ts`; the action follows document direction, so it
appears on the logical opposite side of the password label in Arabic without
changing navigation. The remaining auth copy still needs full internationalization.

## Deferred / known gaps

- No CAPTCHA or leaked-password check is configured in code; hosted Auth policy
  remains a dashboard concern.
- Auth copy is not internationalized.
- Settings source provides Download My Data, full-name editing, and password-
  reauthenticated self-service account deletion. The `delete-account` Edge Function
  is deployed, ACTIVE, and configured with `verify_jwt = true`. An authenticated
  destructive smoke test on a disposable confirmed user passed: whole-user cascade
  deletion completed with no remaining user-owned rows or orphans. Download My Data
  remains available separately. Email change remains deferred.
- No social login, MFA, magic-link, or "remember this device".
