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

The source provides a two-step, mobile-ready confirmation dialog. The user first
reauthenticates with their current password, then types their current email exactly
before the permanent action is enabled. The dialog offers Download My Data before
deletion and clears its password and confirmation whenever it is cancelled or an
attempt fails.

The client sends only the password to the authenticated `delete-account` Edge
Function. The function derives the caller from the bearer session, independently
reauthenticates that email/password, requires the resulting user id to equal the
caller id, then permanently deletes only that caller through the server-only Auth
admin client. It accepts no user id or email, bounds request bodies to 4 KiB,
returns only stable error codes, never logs credentials or user data, and returns
an empty `204` response with `Cache-Control: no-store` on success.

Deletion starts the existing production-safe whole-user cascade. After success,
the client clears the local Supabase session and replaces navigation with `/login`
even if local sign-out fails. If the delete response is lost, only a server-backed
`user_not_found` result is treated as confirmed success; otherwise the dialog
clears credentials and requires reauthentication before retrying. There are no
additional app-owned user caches to clear after the authenticated tree unmounts.

`delete-account` is deployed, ACTIVE, and configured with `verify_jwt = true`.
An authenticated destructive smoke test passed on a disposable confirmed user:
whole-user cascade deletion completed with no remaining user-owned rows or
orphans. Download My Data remains available separately.

## Navigation

Settings is an authenticated route inside `DashboardLayout`, accessible from the
desktop navigation and mobile navigation sheet. It is not a Dashboard card.
