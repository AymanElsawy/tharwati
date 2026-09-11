# Mobile (Flutter)

## Status and scope

`apps/mobile` is the iOS/Android Flutter client (`tharwati_mobile`, version
`1.0.0+1`). It is not limited to the older `apps/mobile/README.md` description:
Auth, onboarding, the production dashboard, and manual Goals are implemented.
Accounts, investments, and full settings are not. This document describes the
code currently under `apps/mobile/lib/`.

## Architecture and startup

`lib/main.dart` initializes `Supabase` with `Env.supabaseUrl` / `Env.supabaseAnonKey`,
constructs the global `AuthService`, and runs `TharwatiApp`. `MaterialApp` uses
`AppTheme.light()`/`dark()` with `ThemeMode.system`, no named route table, and
starts with the presentation-only `SplashScreen`. Its 1000ms logo fade/scale/
settle
then mounts the unchanged `AuthGate` as the normal home flow. While a signed-in
user's onboarding completion is resolving, its presentation-only loading state
continues the same deep-green surface with a centered approved mark and a
subordinate gold spinner. A
`GlobalKey<NavigatorState>` listens for Supabase's `AuthChangeEvent.passwordRecovery`
and pushes `ResetPasswordPage` over the current tree.

Top-level structure:

| Path | Responsibility |
| --- | --- |
| `auth/` | Supabase auth wrapper, session/onboarding gate, auth screens and password policy. |
| `onboarding/` | Five-step profile setup and static country/currency data. |
| `dashboard/` | Edge-snapshot repository, decimal aggregate/allocation logic, controllers, cards. |
| `goals/` | Goal domain, Supabase repository/RPCs, controllers, pages, sheets and widgets. |
| `core/` | Decimal arithmetic, money formatting, app-wide data-change notifier. |
| `theme/`, `widgets/` | Material theme/tokens and reusable presentation components. |
| `home_page.dart` | Authenticated five-tab shell. |

Feature state is local `State` plus `ChangeNotifier` controllers and
`ListenableBuilder`; there is no provider, router, cache/query library, or
offline store. Repositories accept optional `SupabaseClient`s, which makes their
logic testable, but instances are normally created by widgets/controllers.

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

The configured custom link is `tharwati://auth-callback` (`lib/env.dart`),
registered in `android/app/src/main/AndroidManifest.xml` and
`ios/Runner/Info.plist`. Both sign-up confirmation (`emailRedirectTo`) and
password-reset email (`redirectTo`) use it; the Supabase dashboard must allow it.
Android has Internet permission; the iOS deployment target is 13.0. The public
anon credential is embedded by default and can be overridden with
`--dart-define=SUPABASE_URL` and `SUPABASE_ANON_KEY`.

Implemented auth screens:

- `LoginPage`: required nonblank email/password, Supabase sign-in, generic or
  incorrect-credential error, links to signup/reset. The Arabic and EGP pills
  are static visuals, not selectors.
- `SignUpPage`: required name/email, confirmation, terms checkbox, and password
  policy (12+ characters, upper/lowercase and digit). It maps common Supabase
  errors; if confirmation is enabled and no session returns, it shows the
  check-email state. Terms/Privacy labels have no links.
- `ForgotPasswordPage`: required nonblank email and neutral success copy to
  avoid account enumeration; transport failure is generic.
- `ResetPasswordPage`: reached on `PASSWORD_RECOVERY`; validates the same
  password rule and confirmation, maps missing recovery session to expired-link
  copy, then updates the password and signs out. It does not independently
  verify that a reset route/link is a valid recovery session before rendering.

`OnboardingFlow` is complete for its implemented profile-preference scope:
Welcome, searchable country, base currency, multi-select goals, Ready. Country
selection preselects an available default currency; supported base currencies
are EGP, EUR, GBP, SAR, USD. It requires country, currency, and at least one
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
| Accounts | Placeholder | `_ComingSoon` only; no account creation/list/edit flow. |
| Invest | Placeholder | `_ComingSoon` only; no investment flow. |
| Goals | Implemented | `GoalsPage`, detail page, form/entry/actions bottom sheets. |
| Settings | Implemented profile/session surface | `settings/settings_page.dart` reads and edits canonical `profiles.full_name` through `SettingsProfileRepository`, displays the Auth-session email read-only, and signs out. Whitespace-only names save as null; preferences, privacy, and support settings are absent. |

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
`PortfolioAllocationCard`, and `GoalsCard`. `DashboardMasthead` is a
Dashboard-only 286px mountain image with theme-aware readability overlay. The
source mountain bitmap contains cropped lettering at its far-left edge, so the
masthead crops that source edge from the rendered composition. The masthead uses
top safe-area positioning for the theme-aware `TharwatiBrand` and decorative
bell/avatar controls, then current English greeting/date and `Your wealth at a
glance` header copy. Its light-theme overlay is deliberately subdued to retain mountain detail; its
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
future, currency is one of USD/SAR/EGP/EUR/GBP and locks after any history,
completion is explicit, and percentages remain uncapped while only the bar caps
at 100% (with a surplus/hatch treatment).

## Data, backend, validation, and refresh

Supabase is the only mobile backend integration. Direct caller-scoped/RLS reads
are `profiles`, `financial_accounts`, `goals`, and `goal_progress_entries`.
Writes use `complete_onboarding` plus narrow Goals RPCs: `create_goal`,
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

`MoneyFormat` formats money with two decimals and ISO code, percentages up to
two decimals, and LTR numeric text. `D` normalizes exact decimal strings and
returns null on malformed values. Tests cover password policy, dashboard
aggregate edge cases (including all-or-nothing and credit liability), and Goals
validation/replay/history (`apps/mobile/test/`).

## UI, theme, localization, and responsiveness

`AppTheme` uses Material 3, system light/dark mode, and the `AppColors` theme
extension. Inter is the body and financial-value face; Playfair Display is used
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

The UI is English hardcoded. There is no locale state, localization delegates,
translation catalog, or application-wide `Directionality`/RTL switch. Arabic font
fallback exists and numbers/currency/dates are explicitly LTR where rendered;
this is preparation, not Arabic/RTL implementation. Layout is phone-oriented
with `SafeArea`, scrolling, keyboard-inset sheets, flexible/expanded lists, and
some responsive wrapping; it has not been established as a tablet-specific
design.

## Gaps, coupling, and risks

- Accounts, Invest, full Settings, notification behavior, locale/currency
  switching, Arabic/RTL, legal links, export/delete-account,
  OAuth/MFA/phone auth, and offline/realtime support are not implemented.
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
