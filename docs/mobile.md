# Mobile (Flutter)

## Status and scope

`apps/mobile` is the iOS/Android Flutter client (`tharwati_mobile`, version
`1.0.0+1`). It is not limited to the older `apps/mobile/README.md` description:
Auth, onboarding, the production dashboard, and manual Goals are implemented.
Accounts and the implemented Settings profile/preferences surface are complete.
Wealth Analysis and its Brokerage-only Portfolio Analysis child are implemented.
This document describes the
code currently under `apps/mobile/lib/`.

## Architecture and startup

`lib/main.dart` runs `BootstrapApp`. Its controller validates the required
`Env.configuration` before reading auth links or initializing Supabase. Invalid
configuration renders a controlled error screen without backend initialization.
Valid configuration initializes Supabase, constructs the global `AuthService`,
restores device-local preferences, and runs `TharwatiApp`. `MaterialApp` uses
`AppTheme.light()`/`dark()` with the persisted `ThemeMode`, no named route table, and
starts with the presentation-only `SplashScreen`. Its 1000ms logo fade/scale/
settle
then mounts the unchanged `AuthGate` as the normal home flow. While a signed-in
user's onboarding completion is resolving, its presentation-only loading state
continues the same deep-green surface with a centered approved mark and a
subordinate gold spinner. The bootstrap controller captures the cold-start URI before initializing
Supabase, disables the SDK's automatic URI detection, then starts
`AuthRecoveryCoordinator`. The coordinator subscribes to Auth events before it
exchanges that initial URI and owns subsequent warm-link exchange. Its one-shot
recovery state renders `ResetPasswordPage` above the normal gate, so a cold-start
recovery session cannot enter `AuthGate` as an ordinary authenticated session.

Top-level structure:

| Path | Responsibility |
| --- | --- |
| `auth/` | Supabase auth wrapper, session/onboarding gate, auth screens and password policy. |
| `onboarding/` | Five-step profile setup and static country/currency data. |
| `dashboard/` | Edge-snapshot repository, decimal aggregate/allocation logic, controllers, cards. |
| `analysis/` | Wealth Analysis domain/service/repositories, controller, target editor, allocation and drift presentation. |
| `portfolio/` | Brokerage-only read models, Supabase repository, decimal-safe valuation/allocation, coverage and freshness evidence, race-safe controller, and read-only Portfolio Analysis page. |
| `goals/` | Goal domain, Supabase repository/RPCs, controllers, pages, sheets and widgets. |
| `core/` | Decimal arithmetic, money formatting, app-wide data-change notifier. |
| `theme/`, `widgets/`, `i18n/` | Material theme/tokens, reusable presentation components, and device-local language state/copy. |
| `home_page.dart` | Authenticated five-tab shell. |

Feature state is local `State` plus `ChangeNotifier` controllers and
`ListenableBuilder`; there is no provider, router, cache/query library, or
offline store. Repositories accept optional `SupabaseClient`s, which makes their
logic testable, but instances are normally created by widgets/controllers.

## Required build environment configuration

Every debug, profile, and release build requires these compile-time Dart defines.
Flutter does not read a runtime `.env` file. There are no hosted-project or
localhost defaults.

| Define | Required value |
| --- | --- |
| `THARWATI_ENVIRONMENT` | Exactly `development` or `production`. Other identities, including staging, are rejected until explicitly supported. |
| `SUPABASE_URL` | Project base URL with a valid DNS/IP host; no credentials, API path, query, or fragment. A trailing slash is allowed. Production requires non-local HTTPS. Development allows HTTPS or explicit local HTTP. |
| `SUPABASE_PUBLISHABLE_KEY` | Public `sb_publishable_*` key for that project. Secret/service-role keys and legacy JWT keys are rejected. |

The identity labels the build; it does not select or infer a project. Builders
must supply the matching project URL/key and use local Supabase or a separate
hosted development project. Production rejects localhost names, single-label/local
development hostnames, loopback, private, link-local, unspecified, and shared
address-space IP endpoints even with HTTPS. Development HTTP is limited to those
local endpoints; arbitrary hosted HTTP is rejected. No identity is inferred from
the URL. Classification is local and does not resolve DNS; builders must ensure
production hostnames actually route to the intended hosted project.
Offline validation checks syntax, not whether the supplied key belongs to the
project. These public values are embedded in the app; never supply privileged
credentials.

Missing or malformed values show **App configuration required** with rebuild
instructions (localized in Arabic). The app does not initialize Supabase,
restore/refresh a backend session, exchange auth links, or mount backend-dependent
screens. Startup recovery uses local Material fonts, avoiding remote font fetches.
Retry revalidates the same build values; correct the defines and rebuild/reinstall
the app. Hot reload cannot supply missing compile-time values.

### Android emulator local development (PowerShell)

Use the dedicated current `TharwatiMobileDevelopment` environment, not the stale
default `Tharwati` stack. From the repository root:

```powershell
./scripts/database/start-local-development.ps1
# Separate terminal: keep the function server running.
./scripts/database/start-local-development.ps1 -ServeFunctions
# Once functions are serving:
python ./scripts/database/probe-local-development.py
```

First start uses only the approved fresh bootstrap; later starts preserve local
test data and refuse changed bootstrap inputs. No historical reset or hosted
Supabase is used. See [the supported workflow](database-bootstrap.md#supported-mobile-local-development)
for service topology, provider limits, probes, and restart boundaries.
From repository root, load only the local public key and launch Mobile:

```powershell
$localStatus = Get-Content ./mobile-development.local/status.json -Raw | ConvertFrom-Json
$env:THARWATI_LOCAL_SUPABASE_PUBLISHABLE_KEY = $localStatus.PUBLISHABLE_KEY
Set-Location apps/mobile
flutter run --debug -d emulator-5554 `
  --dart-define=THARWATI_ENVIRONMENT=development `
  --dart-define=SUPABASE_URL=http://10.0.2.2:58321 `
  "--dart-define=SUPABASE_PUBLISHABLE_KEY=$env:THARWATI_LOCAL_SUPABASE_PUBLISHABLE_KEY"
```

`10.0.2.2` maps to the host from the standard Android emulator; the dedicated
API port is `58321`. `localhost` inside the emulator refers to the emulator,
not the Windows host. The debug-only Android network policy permits HTTP to
`10.0.2.2`, `127.0.0.1`, and `localhost`; other local destinations may need their
own platform transport setup. Release/profile transport settings and iOS ATS
are unchanged; use HTTPS there. A local stack exposing only legacy anon JWT
keys does not meet this publishable-key contract. Do not use its service-role
key as a substitute. No stack is started or reset by the Mobile command. Sign in
with the synthetic user in ignored `mobile-development.local/smoke-user.json`
(read it locally; never commit credentials). The probe completes onboarding with
SAR base currency and creates a SAR cash account and a Goal with saved progress.
No production users/data, provider quotes, or FX rates are copied or fabricated.

### Android emulator hosted development (PowerShell)

From `apps/mobile`, set these values from your separate HTTPS development project
(replace the placeholders), then run:

```powershell
$env:THARWATI_DEV_SUPABASE_URL = 'https://<development-project-ref>.supabase.co'
$env:THARWATI_DEV_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_<development-public-key>'
flutter pub get
flutter devices
flutter run -d emulator-5554 `
  --dart-define=THARWATI_ENVIRONMENT=development `
  "--dart-define=SUPABASE_URL=$env:THARWATI_DEV_SUPABASE_URL" `
  "--dart-define=SUPABASE_PUBLISHABLE_KEY=$env:THARWATI_DEV_SUPABASE_PUBLISHABLE_KEY"
```

Use the emulator ID shown by `flutter devices` if different. This command
explicitly uses a development HTTPS project. Android signing is unchanged.

### Android production release signing (Security Slice S3-A)

The applicationId and namespace remain `com.tharwati.tharwati_mobile`. The
applicationId still has a template TODO in Gradle: its final production identity
requires owner confirmation before publication. Signing does not require a
package rename. No upload keystore or production signing configuration is present
in the repository. S3 remains **BLOCKED** pending identity confirmation, manual
key provisioning, and a signed release build/certificate verification.

`android/app/build.gradle.kts` uses a separate `release` signing configuration;
debug/emulator builds retain Android's normal debug signing. A resolved task graph
containing an app Release task fails before execution when signing configuration
is absent, unreadable, incomplete, or points to a missing keystore. Invalid
passwords/aliases/keystores fail in Android's signing validation. There is no debug
fallback. The `verifySigningArchitecture` Gradle task checks config separation
without needing credentials. The graph guard requires Gradle's normal task graph
mode; do not enable configuration cache for these checks/builds.

Use Play App Signing: the local **upload key** signs the AAB sent to Google;
Google's separate **app-signing key** signs APKs delivered to users. The Flutter
AAB project and current syntactically valid package support this architecture.
Repository inspection cannot establish package availability, ownership, prior
publication, or Console enrollment. Confirm those manually and reuse the existing
registered upload key if one exists. No Play Console changes are made here.
See [Flutter Android deployment](https://docs.flutter.dev/deployment/android) and
[Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756).

After review, run this **once** in Windows PowerShell (JDK `keytool` on PATH).
Do not run it if the intended upload key already exists. Passwords are prompted;
never add password arguments or use the debug keystore/passwords:

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.tharwati\signing"
keytool -genkeypair -v -keystore "$env:USERPROFILE\.tharwati\signing\upload-keystore.jks" -storetype JKS -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

Keep the keystore outside the checkout at the path above. Create the ignored
`apps/mobile/android/key.properties` locally with this format (replace placeholders;
forward slashes avoid Java-properties backslash escaping; paths resolve relative
to `android` when not absolute):

```properties
storeFile=C:/Users/<WINDOWS_USER>/.tharwati/signing/upload-keystore.jks
keyAlias=upload
storePassword=<STORE_PASSWORD>
keyPassword=<KEY_PASSWORD>
```

Prefer omitting the two password lines and injecting
`THARWATI_UPLOAD_STORE_PASSWORD` and `THARWATI_UPLOAD_KEY_PASSWORD` from a password
manager or protected CI secret store into the build process environment. The
corresponding path/alias overrides are `THARWATI_UPLOAD_STORE_FILE` and
`THARWATI_UPLOAD_KEY_ALIAS`; nonblank environment values take precedence over
local properties. Do not put passwords in command arguments, shell history,
logs, Dart defines, or tracked files. If passwords are stored in local properties,
restrict that file's Windows ACL to the builder account and required administrators.
Restrict the keystore ACL too; clear injected environment secrets after building.
Root and Android `.gitignore` rules exclude `key.properties`, `*.jks`, and
`*.keystore`. Never commit the upload key, private keys, signing passwords, or
other signing secret files; ignore rules do not protect already tracked files.

From `apps/mobile`, with the existing production public build configuration in
the environment and a new increasing build number:

```powershell
flutter build appbundle --release --build-number="$env:THARWATI_BUILD_NUMBER" `
  --dart-define=THARWATI_ENVIRONMENT=production `
  "--dart-define=SUPABASE_URL=$env:THARWATI_PROD_SUPABASE_URL" `
  "--dart-define=SUPABASE_PUBLISHABLE_KEY=$env:THARWATI_PROD_SUPABASE_PUBLISHABLE_KEY"
```

Verify the AAB's JAR signature, then compare its certificate SHA-256 fingerprint
against the expected upload certificate (a self-signed certificate warning is
normal; any unsigned entries or signature failure must be investigated):

```powershell
jarsigner -verify -verbose -certs build/app/outputs/bundle/release/app-release.aab
keytool -printcert -jarfile build/app/outputs/bundle/release/app-release.aab
keytool -list -v -keystore "$env:USERPROFILE\.tharwati\signing\upload-keystore.jks" -alias upload
```

For a locally generated release APK, run the installed SDK's `apksigner` (replace
the build-tools version), and compare its signer SHA-256 to the upload certificate:

```powershell
& "$env:LOCALAPPDATA\Android\sdk\build-tools\<VERSION>\apksigner.bat" verify --verbose --print-certs build/app/outputs/flutter-apk/app-release.apk
```

An APK downloaded from Play must instead match the **app-signing** certificate
shown in Play Console. Maintain an encrypted offline backup of the upload
keystore, with passwords stored separately in the approved password manager;
limit access, record the alias and public SHA-256 fingerprint, and test restoration.
Loss of an upload key may require Play's upload-key reset process; never assume
a newly generated key can replace an already registered key automatically.

Focused checks from `apps/mobile/android`:
`./gradlew.bat :app:verifySigningArchitecture --offline --console=plain` and,
with signing configuration absent,
`./gradlew.bat :app:bundleRelease --dry-run --offline --console=plain`
(must fail with the explicit production-signing message). Debug task planning
can be checked with `:app:assembleDebug --dry-run`. A signed AAB and fingerprint
comparison remain manual until the protected upload key is provisioned.

Validation on 2026-10-01: signing architecture task passed; debug assemble
dry-run passed without upload credentials; combined release bundle/APK dry-run
failed with the intended production-signing message. Ignore probes passed for
local properties and both keystore extensions, and no tracked keystores/signing
properties or private-key/password literals were found by focused static checks.
`git diff --check` passed. No Dart files were touched, so Flutter analysis was
not run. These checks do not constitute a complete debug build or signed release
build. Existing Gradle/Kotlin deprecation warnings remain outside S3-A scope.

### iOS production / TestFlight (Mac shell)

Set `THARWATI_PROD_SUPABASE_URL` and `THARWATI_PROD_SUPABASE_PUBLISHABLE_KEY`
to the existing production project's HTTPS URL and public publishable key, and
`THARWATI_BUILD_NUMBER` to an unused increasing TestFlight build number. From the
repository root:

```bash
cd apps/mobile
flutter pub get
flutter build ipa --release \
  --build-number="${THARWATI_BUILD_NUMBER:?Set a new TestFlight build number}" \
  --dart-define=THARWATI_ENVIRONMENT=production \
  --dart-define=SUPABASE_URL="${THARWATI_PROD_SUPABASE_URL:?Set the production HTTPS project URL}" \
  --dart-define=SUPABASE_PUBLISHABLE_KEY="${THARWATI_PROD_SUPABASE_PUBLISHABLE_KEY:?Set the production publishable key}"
```

Upload the resulting `build/ios/ipa` artifact using the existing TestFlight
workflow and Apple signing setup. Flutter generates the Xcode Dart defines;
the existing Release configuration includes `Generated.xcconfig`. Do not rely
on an old Xcode archive or cached generated configuration: regenerate with the
explicit production command. Correctly supplied configuration preserves the
existing auth, recovery, and session behavior. No hosted setting changes are
required by this slice.

## Auth, session, and onboarding

`AuthService` (`lib/auth/auth_service.dart`) wraps email/password-only
`supabase.auth`: sign-up, sign-in, sign-out, reset-email request, password
update, and profile onboarding calls. It stores full name in auth metadata as
`full_name`; the backend trigger is expected to create the profile row.

`AuthGate` subscribes to `onAuthStateChange` and uses the persisted current
session as a fallback. Signed-out users see `LoginPage`; signed-in users wait
while it reads their own `profiles.onboarding_completed`, then see
`OnboardingFlow` or `HomePage`. Token refresh for the same user preserves the
resolved gate state. The gate has an account-load spinner, retry callout, and
sign-out fallback.

Confirmed account deletion also activates `AccountExitCoordinator`, an explicit
app-level forced-signed-out state observed by `AuthGate`. This renders Login
before best-effort local session cleanup completes, so a cached session cannot
briefly restore authenticated content. Only a later fresh `SIGNED_IN` event
releases that state.

`AuthRecoveryCoordinator` accepts only the exact `tharwati://auth-callback`
scheme/host. PKCE query callbacks must contain exactly one URL-safe authorization
code; the legacy token/error payload handling remains for signup confirmation.
It activates only after
Supabase successfully emits `passwordRecovery`; ordinary `initialSession`,
`signedIn`, refresh, and user-update events leave normal routing untouched.
Expired, malformed, reused, and non-auth links stay outside reset UI. URI handling
is serialized and process-local duplicate callbacks are ignored. Completion and
cancellation explicitly clear recovery; cancellation first performs best-effort
local sign-out.

The configured custom link is `tharwati://auth-callback` (`lib/env.dart`),
registered in `android/app/src/main/AndroidManifest.xml` and
`ios/Runner/Info.plist`. Both signup confirmation (`emailRedirectTo`) and
password recovery (`redirectTo`) currently use it; the Supabase dashboard must
allow it. Host/domain-dependent HTTPS handoff and verified App/Universal Links
remain deferred. Android has Internet permission; the iOS deployment target is
13.0. Environment identity, URL, and public publishable credential are all
required Dart defines as described above. Missing or invalid configuration
shows the startup configuration screen; no secret key is embedded in the app.

Implemented auth screens:

- `LoginPage`: required nonblank email/password, Supabase sign-in, generic or
  incorrect-credential error, links to signup/reset. English and Arabic controls
  switch the app language before login; the former static EGP pill is absent.
- `SignUpPage`: required name/email, confirmation, terms checkbox, and password
  policy (12+ characters, upper/lowercase and digit). It maps common Supabase
  errors; if confirmation is enabled and no session returns, it shows the
  check-email state. Terms/Privacy labels have no links.
- `ForgotPasswordPage`: required nonblank email and neutral success copy to
  avoid account enumeration; transport failure is generic. Its English and Arabic
  request copy states the hosted 60-minute recovery-link expiry.
- `ResetPasswordPage`: reached on `PASSWORD_RECOVERY`; validates the same
  password rule and confirmation, maps missing recovery session to expired-link
  copy, then updates the password and performs best-effort sign-out. A successful
  password update remains a success even if remote sign-out reports a failure;
  Supabase clears the local session before remote revocation. The screen has
  explicit completion and cancellation paths, and it renders only from the
  coordinator's validated recovery state.

`OnboardingFlow` is complete for its implemented profile-preference scope:
Welcome, searchable country, base currency, multi-select goals, Ready. Country
selection preselects an available default currency; supported base currencies
are AED, EGP, EUR, GBP, SAR, USD. UAE preselects AED. It requires country, currency, and at least one
goal, then calls `complete_onboarding(p_country_code, p_base_currency_code,
p_selected_goals)` and refreshes the gate. Selected onboarding goals are
preferences only: they create neither Goals nor balances.

## Navigation and screens

The authenticated `HomePage` is an `IndexedStack` with a Material 3 bottom
`NavigationBar`. Its visual shell uses a 64px navigation row inside a bottom
`SafeArea`, with a surface background, top border, and semantic active/inactive
icon and label colours. The five destinations and their `IndexedStack` behavior
are unchanged:

| Destination / reachable screen | State | Current behavior and principal files |
| --- | --- | --- |
| Dashboard | Implemented | `DashboardScreen` loads valuations and a separate read-only goals card. “Add account” switches to Accounts; “View all” switches to Goals. |
| Accounts | Full presentation localization implemented | The list, create/edit form, generic detail and lifecycle dialogs, Real Estate/Business valued detail, Cash/Bank records read/write surfaces, Gold/Silver detail and purchases, plus brokerage detail, trades, and dividends support English/Arabic. Raw lower-layer errors remain language-agnostic. |
| Analysis | V1 implemented; Portfolio Analysis implemented | The third tab is `Analysis` / `التحليل` and opens the launch hierarchy: Wealth Health, Attention Summary, six-class Wealth Allocation, then Target Allocation & Drift with the full-screen Edit Target flow. Dashboard Portfolio Allocation and the Wealth Analysis Brokerage row open the same Brokerage-only Portfolio Analysis child page with account scope, summary and coverage, Available Cash and Current Value, securities allocation, and holdings grouped by account. Standalone Key Insights, Structure/Exposure, diversification, liquidity, currency, detailed valuation-quality, and asset-explorer sections remain deferred. |
| Goals | Implemented | `GoalsPage`, detail page, form/entry/actions bottom sheets. |
| Settings | Implemented profile/session/deletion surface | `settings/settings_page.dart` reads and edits canonical `profiles.full_name` through `SettingsProfileRepository`, displays the Auth-session email read-only, changes the shared device-local English/Arabic and Light/Dark appearance preferences, signs out, and provides a localized Danger Zone for permanent account deletion. Deletion reauthenticates by password, requires the exact email, and reuses the authenticated `delete-account` Edge Function. Whitespace-only names save as null; export and support settings are absent. |

Within Cash/Bank record forms, the searchable category sheet preserves the
shared Web category tree and selection contract. Main categories are 52px,
bordered primary rows; only parents with children expose an expansion chevron.
Expanded children live in a smaller-type, secondary field-fill container with a
directional start-side nesting rule, so the indentation and accent border mirror
in Arabic. The same semantic surface, field-fill, line, ink, and accent tokens
maintain that distinction in Light and Dark modes without category imagery.

Dashboard (`dashboard/dashboard_screen.dart`) is the implemented production
summary, not the richer web-only dashboard. `DashboardController` loads profile
base currency, active `financial_accounts`, and the server `dashboard-valuation`
snapshot. It shows skeletons while loading; a no-base-currency prompt; a retry
callout on transport/parse failure; and a complete, incomplete, or no-account
net-worth card. Pull-to-refresh is available. The no-base-currency button says
“Complete onboarding” but calls `authService.signOut()`; it does not resume
onboarding directly.

When ready, the dashboard renders `DashboardMasthead`, `NetWorthHero`,
`AssetsBreakdownCard`, deterministic `KeyInsightsCard`,
`PortfolioAllocationCard`, and `GoalsCard`. Assets Breakdown switches to the
Wealth Analysis tab. Portfolio Allocation is a Brokerage-only preview that
opens the separate Portfolio Analysis child page; it does not switch to a
top-level Portfolio tab.
`DashboardMasthead` is a
Dashboard-only 286px mountain image with theme-aware readability overlay. The
source mountain bitmap contains cropped lettering at its far-left edge, so the
masthead crops that source edge from the rendered composition. The masthead uses
top safe-area positioning for the theme-aware `TharwatiBrand` and decorative
bell/avatar controls, then localized English/Arabic greeting, date, and wealth
summary copy. Its light-theme overlay is deliberately subdued to retain mountain detail; its
lower gradient is slightly denser behind the semantic-ink slogan, while its
dark-theme overlay remains independently stronger for readability.
`NetWorthHero` overlaps it by 32px, below that header content, and shows Total
Net Worth plus Assets, Liabilities, and account-count summary metrics. The notification
bell/avatar are visual only. The dashboard intentionally omits a
performance/delta claim, recent activity, accounts overview, historical charts,
and account editing.

Financial rules implemented in `calculateDashboardAggregate` are important:

- All amounts are decimal strings (`core/decimals.dart`); no financial aggregate
  is calculated with `double`.
- Asset groups are cash/bank, brokerage, gold/silver, real estate, business,
  certificates (currently always zero), and other. Bank credit accounts are
  excluded from assets; liability is `credit_card_limit - ledger balance`.
- Native current values are converted using snapshot `FROM/BASE` rates. Any
  missing active-account value, rate, or invalid conversion makes *all* totals
  and breakdown values unavailable—never partial.
- Positive brokerage holdings alone form allocation; types are grouped and the
  final percentage receives the rounding residual so displayed percentages total
  100. Incomplete/no-positive holdings produce explicit card messages.

Goals is a complete manual tracker MVP (`goals/`). Its presentation uses the
semantic light/dark card, field, and typography system across lists, detail,
and write/action sheets; loading uses static card placeholders. `GoalsPage` has Current and
Archived filters, pull-to-refresh, load/mutation errors, empty states, create,
edit, detail, progress, withdrawal, correction/reversal, complete/cancel,
reopen, archive, and unarchive. `GoalDetailPage` shows an immutable timeline;
mobile Correct/Reverse apply only to the most recent correctable entry, from the
overflow sheet. `GoalFormSheet`, `GoalEntrySheet`, and `GoalActionsSheet` are
the write surfaces; `GoalListCard`, `GoalProgressBar`, `GoalStatusPill`, and
`GoalMoney` are shared visual components.

Goals never reserve or move money, post transactions, modify account balances,
or affect net worth. Progress is an independent append-only ledger: `progress`
adds, `withdrawal` subtracts, and `reversal` applies the opposite effect of its
linked original. Corrections record a reversal and optional replacement; funded
amount must not become negative. Amounts/targets are positive, dates may not be
future, currency is one of USD/SAR/EGP/EUR/GBP/AED and locks after any history,
completion is explicit, and percentages remain uncapped while only the bar caps
at 100% (with a surplus/hatch treatment).

## Data, backend, validation, and refresh

Supabase is the only mobile backend integration. Direct caller-scoped/RLS reads
are `profiles`, `financial_accounts`, `goals`, `goal_progress_entries`,
`wealth_allocation_targets`, and `wealth_allocation_target_preferences`.
Writes use `complete_onboarding`, the atomic
`replace_wealth_allocation_plan` target-preference RPC, plus narrow Goals RPCs: `create_goal`,
`update_goal`, `add_goal_progress_entry`, `correct_goal_progress_entry`,
`set_goal_status`, and `set_goal_archived`. Dashboard valuation calls the
authenticated `dashboard-valuation` Edge Function; its payload is strictly
parsed by `DashboardSnapshot.parse`. The documented 15-minute server cache is
not duplicated on device.

`GoalsRepository` maps selected RPC errors to user messages. `GoalsService`
performs client validation and `GoalsController` serializes UI mutation state
with one `busy` flag, reloads after success, and exposes `actionError`.
`DataChange.instance` is a process-local notifier: successful Goals writes ping
it; `DashboardController` silently reloads, while `DashboardGoalsController`
reloads its card through its normal loading state. There is no
realtime subscription, persistence, retry/backoff policy, or cross-device
invalidation.

The Analysis tab also refreshes when it becomes active. Its controller uses a
request generation guard so an older async failure cannot replace newer loaded
data, and it ignores completions after disposal. Background refresh failures
keep the last successful analysis visible with an explicit warning; genuine
initial failures retain the full error state.

`MoneyFormat` formats general money with two decimals and ISO code, rounds
Target Drift monetary gaps to whole display units without changing their stored
precision, formats percentages up to two decimals, and keeps numeric text LTR.
`D` normalizes exact decimal strings and
returns null on malformed values. Tests cover password policy, dashboard
aggregate edge cases (including all-or-nothing and credit liability), and Goals
validation/replay/history (`apps/mobile/test/`).

## UI, theme, localization, and responsiveness

`AppTheme` uses Material 3 Light/Dark themes and the `AppColors` theme
extension. The app restores the user's persisted Light/Dark preference rather
than following system theme mode. Inter is the body and financial-value face; Playfair Display is used
for brand, page, section, and display headings; Noto Sans Arabic is the fallback
when Arabic copy is introduced. Shared tokens define the palette, radii,
spacing, 44px minimum touch targets, and 52px fields/buttons. Auth/onboarding
share scaffolds, buttons, text fields, callouts, brand mark, strength bar, and
step indicator; Goals shares mobile-aware modal sheets. The approved logo light/
dark assets are rendered by `widgets/tharwati_brand.dart`; the approved mountain
asset is used only by `DashboardMasthead`. Dashboard has custom-painted
donut/dashed/hatch components and honors reduced motion for skeleton fade and
net-worth count-up.

Native launch branding is a static `#071C17` surface with the approved square
Tharwati mark centered: Android uses `drawable/launch_background.xml` (and its
Android 12 launch theme), while iOS uses `LaunchScreen.storyboard` plus the
`LaunchLogo.imageset`. Android launcher density icons and every iOS AppIcon slot
are resized from the same approved mark. Android API 26+ resolves normal and
round launcher references to an adaptive icon with a separate deep-green
background and a centered transparent mark foreground sized to 66% of the
adaptive viewport (18dp outer margin at mdpi); the legacy density icons remain as
the pre-26 fallback. The Flutter `SplashScreen` continues
that surface with a 1000ms fade-in, a centered 200-to-132 logical-pixel scale,
and vertical settle before
mounting `AuthGate`; it owns no authentication or routing decisions.

`AppLanguageController` persists `en`/`ar` with `shared_preferences` under the
web-parity `tharwati-language` key. `MaterialApp.locale` and an app-wide
`Directionality`, with Flutter's Material/Widgets/Cupertino localization
delegates, update before or after authentication; Login, bottom navigation,
Dashboard, Settings, Goals presentation across lists, details, forms, actions,
confirmations, and history, plus all currently implemented Accounts presentation:
list, create/edit, generic and valued details, Cash/Bank records, Gold/Silver
detail and purchases, and brokerage detail, trade, and dividend flows, are
translated. Raw lower-layer Accounts errors remain language-agnostic.
`AppThemeController` persists the Light/Dark choice under `tharwati-theme` and
drives `MaterialApp.themeMode` before Login; Colorful and system-following modes
are not offered on mobile. Native launch branding remains fixed deep green.
Arabic font fallback exists. Numeric, money, email, and date values remain LTR;
within Arabic captions, only dynamic values use bidi isolation while surrounding
labels retain RTL direction. Layout is phone-oriented
with `SafeArea`, scrolling, keyboard-inset sheets, flexible/expanded lists, and
some responsive wrapping; it has not been established as a tablet-specific
design. Inline Analysis header actions use the existing compact finite-width
control so they remain valid Row children on narrow screens.

## Gaps, coupling, and risks

- Wealth Analysis implements the approved mobile foundation by reusing the
  Dashboard valuation aggregate and the shared Web/Mobile target-plan contract.
  Its compact allocation donut and target cards use the same section order,
  six-class product order, tolerance semantics, and status language as web;
  Net Worth remains secondary in Wealth Health, and the target editor starts an
  unsaved plan at zero for all fields. Portfolio Analysis and the later
  specialized/cross-asset analysis sections remain placeholders or deferred.
  Settings currently includes Profile, Language, Appearance, Sign out, and
  in-app permanent account deletion; notification behavior, currency switching,
  legal links, data export, OAuth/MFA/phone auth, and offline/realtime support are
  not implemented. The Google Play external deletion-request URL remains deferred
  until the final production domain is available.
- Dashboard calls the shared Edge Function but reproduces web aggregate and Goal
  rules in Dart. Comments identify these as ports; changes to web/database
  contracts can drift unless tests/contracts are maintained in both clients.
- `DataChange` only refreshes mounted in-process listeners; account/transaction
  flows do not yet exist to emit it, and external changes are not observed.
- Raw exception detail is generally hidden from users. Dashboard `errorReason`
  is retained but not displayed, which helps safety but complicates diagnosis.
- `HomePage` constructs all tab pages inside an `IndexedStack`; dashboard and
  Goals controllers can load while their tab is not visible. Its current visual
  shell is a 64px row plus bottom safe-area inset; navigation is
  ad-hoc index changes and `MaterialPageRoute`, not declarative/deep-link routing.
- Country/default-currency data is copied from web files; currency support is
  deliberately narrower than country defaults. Static source comments, the
  mobile README, and older shared-doc sections can lag implemented scope.

## Relationship to Tharwati domain

The client is a UI over the existing user-scoped Supabase product. It uses the
same profile onboarding RPC, supported currency codes, dashboard valuation
snapshot, financial-account semantics, Goals tables/RPC lifecycle, decimal-string
rules, and manual-goal separation from net worth as the web product. It neither
connects to banks nor creates real-money transfers. Server RLS and RPC ownership
enforcement remain the data boundary; `AuthGate` is a client UX guard.
