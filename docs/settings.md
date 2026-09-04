# Settings

## Purpose

The protected `/settings` page provides small, user-owned account preferences and
privacy controls. It is responsive as one column on mobile, retains 44 px action
targets, and follows the active English/Arabic direction.

## Profile

Settings reads the authenticated profile and Auth email. Only `full_name` is
editable. Saving calls the existing RLS-protected `profiles` update path after the
client obtains its authenticated user id; it never accepts or sends another user
id. A successful save refreshes the existing shared profile provider, so the app
shell/header reflects the new name without a page reload. Email is display-only because no confirmed in-app email-change workflow is
implemented. Avatar, country, and base currency remain out of scope.

## Privacy & Data

Download my data calls the shared `UserDataExportService`, which requests the
deployed authenticated `export-my-data` function and downloads the response as an
attachment without rendering its contents. The browser uses the server attachment
filename when exposed and otherwise uses the v1 date-based fallback. The UI makes
loading, successful start, throttle, too-large, expired-session, and generic
failure states explicit. JSON is never stored by the page.

Privacy Policy and Terms have truthful launch placeholders because no legal routes
or approved legal copy exist yet.

## Delete account

The destructive section is intentionally disabled. It does not invoke Auth admin
APIs, database deletion, or a success state. Stage 4 must add the confirmed
self-service deletion UX around the already-hardened whole-user deletion backend.

## Navigation

Settings is an authenticated route inside `DashboardLayout`, accessible from the
desktop navigation and mobile navigation sheet. It is not a Dashboard card.
