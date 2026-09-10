# Goals

## Purpose and scope

Goals are manual progress trackers. They do not reserve money, post financial transactions, alter account balances or Net Worth, or prove that funds are exclusively allocated to one goal. The same real-world money may be represented manually in multiple goals. Onboarding `profiles.selected_goals` remains preference data and never creates a Goal.

## Data model

`goals` stores the authenticated user's name, fixed type (`buy_home`, `buy_car`, `travel`, `education`, or `other`), required custom type for `other`, positive target amount, supported currency, optional target date, lifecycle status (`active`, `completed`, `cancelled`), and independent archive timestamp.

`goal_progress_entries` is append-only. Every amount is a positive PostgreSQL numeric. `progress` adds tracked savings, `withdrawal` removes tracked savings, and `reversal` negates the effect of one original progress/withdrawal entry. `reverses_entry_id` links the reversal to its original and `replacement_for_entry_id` links the corrected replacement to that same original. Unique partial indexes permit at most one reversal and one replacement per original, while a replacement remains an ordinary effective entry that can form the next link in a correction chain. Effective dates cannot be in the future. Direct updates and deletes are blocked.

Funded amount is `progress - withdrawal`, with a reversal applying the opposite sign of its linked original. Corrections atomically insert a reversal using the original effective date and an optional explicitly-linked replacement using the corrected amount/date. Operations that would make funded amount negative are rejected and rolled back. Goal ownership serializes mutations so concurrent withdrawals/corrections cannot bypass this rule.

## Lifecycle and validation

- Target amount is greater than zero and remains editable.
- Currency is permanently locked after any progress history exists.
- Optional Saved so far during creation atomically creates the initial progress entry.
- Progress and withdrawals require an active, non-archived goal.
- Completion is explicit; reaching 100% does not complete automatically.
- Funded amount and percentage remain uncapped; only the visual bar caps at 100%.
- Completed and cancelled goals can be reopened. Archive is independent and archived goals remain readable.
- All monetary values, comparisons, and formatting remain decimal-string safe. Native numbers are used only for the final capped progress-bar width required by the visual component.

## Security and API

RLS permits authenticated users to read only their own goals and entries. Mutation RPCs derive ownership from `auth.uid()`, use a fixed empty `search_path`, validate lifecycle and amounts, and execute create-with-initial-progress and corrections atomically. Authenticated clients receive only SELECT table grants and EXECUTE grants for the narrow mutation RPCs; internal funded-amount and trigger functions are explicitly non-executable by clients. Goals cascade from their owning Auth user, and progress rows cascade from their Goal. The immutable-entry trigger permits only those parent/user cascade paths and continues to reject ordinary direct updates or deletes, preventing orphan Goals or progress rows.

## UI

The protected `/goals` route provides current and archived lists, Add/Edit Goal, details, Add Progress, Withdraw, Correct, Reverse, Complete, Cancel, Reopen, Archive, and Unarchive. While the initial load is in flight the page renders an `aria-busy` skeleton that mirrors the header and two-column layout instead of a text spinner. New goals default their currency selector to the authenticated profile's `base_currency_code`, while edits retain the goal's stored currency. Details show the truthful funded amount, target, uncapped percentage, target date, status, and full chronological immutable history. Correction chains are visually grouped beneath their original entry. The original, the recorded correction or reversal, and any updated entry have distinct plain-language labels while the audit explanation remains secondary. Goal money presents the signed amount before the currency (for example, `−500,000 EGP`) in an LTR-isolated span for stable English and Arabic/RTL rendering. Add Progress and Withdraw remain primary actions; lifecycle and archive actions collapse into an overflow menu on narrow screens. English and Arabic cover all Goals labels, validation, confirmation, and error states. The forms and domain/service layer are responsive and reusable by a future mobile client.

The production Dashboard shows a separate read-only Goals card after Accounts Overview. It displays at most three active, unarchived goals, ordered by target date with undated goals last and oldest creation time as the tie-breaker. Progress uses the same exact funded calculation and remains in each goal's own currency: no FX conversion, cross-goal total, account funding, or Net Worth effect is implied. The card shows uncapped percentage and surplus while capping only the visual bar at 100%, labels overdue dates without forecasting, states that tracking is manual and money is not reserved, and links to `/goals`. Dashboard loading and errors are isolated from valuation data.

## Mobile (Flutter) implementation — built

`tharwati_mobile/lib/goals/` ships Goals as design canvas **Flow 5** (artboards
19 Goals current, 20 Goals archived, 21 Goal detail, 22 Goal actions sheet, 23
Add/edit goal). It reuses the **same tables and mutation RPCs** as the web — no
new schema — and ports the domain logic 1:1 so funded amount, percentages,
currency lock, and correction chains behave identically.

### Logic (ported from `src/features/goals/`)

| Web | Mobile |
|---|---|
| `domain/goals.ts` `fundedAmount` / `toGoalSummary` | `goal_math.dart` (progress/withdrawal/reversal replay; uncapped `progressPercent`, `displayPercent` capped at 100 for the bar, `surplusAmount`) |
| `domain/goals.ts` `validateGoalInput` / `validateEntryInput` | `goal_math.dart` `validateGoalInput` / `validateEntryInput` → `GoalValidation` enum + English messages; run **before** the RPC |
| `services/goals.service.ts` `buildGoalHistoryEntries` / `groupGoalHistoryEntries` / `historyEntryType` / `historySign` | `goal_history.dart` (reversal/replacement back-links, recursive correction-chain grouping oldest-child-first, sign inheritance) |
| `repositories/goals.repository.ts` (`list`, `listActiveSummaries`, `create/update/addEntry/correctEntry/setStatus/setArchived`) | `goals_repository.dart` — reads hit the RLS tables; writes call `create_goal` / `update_goal` / `add_goal_progress_entry` / `correct_goal_progress_entry` / `set_goal_status` / `set_goal_archived`. Money/quantity params are passed as decimal **strings**. |
| `components/goal-error-message.ts` | `goals_repository.dart` `_friendly` — maps the RPC `raise exception` texts ("Withdrawal exceeds funded amount", "currency is locked", "Entry already reversed", "Correction would make funded amount negative", …) to friendly copy; surfaced as `GoalActionException` |
| `services/goals.service.ts` `loadGoals` + page state | `goals_service.dart` (`loadGoals`, validated mutations, `DataChange.ping()` after every write) + `goals_controller.dart` (`loading`/`error`/`ready`, Current/Archived filter, `busy`/`actionError` mutation wrapper, active-first `visible` sort) |

All-or-nothing decimal safety carries over from Flow 2's `lib/core/decimals.dart`
(`D`) and `lib/core/money_format.dart`. Every mutation pings `DataChange`, so the
dashboard Goals card (`DashboardGoalsController`, unchanged) refreshes — the
mobile stand-in for the web `tharwati:data-changed` event.

### UI

`goals_page.dart` (Current/Archived segmented lists + footer note + empty/error
states) → `goal_detail_page.dart` (funded/target hero, Add progress / Withdraw,
and the canvas screen-21 **rail-and-dot history timeline**: a coloured dot per
entry — green progress / red withdrawal / amber reversal+correction / grey "Goal
created" — a `title + amount` line, a `date · time · note` line, and a closing
"Goal created" row; a replacement shows `old → new`. Correct / Reverse are on the
⋯ actions sheet, not per row, matching the canvas). Sheets:
`goal_form_sheet.dart` (add/edit — type chips, currency locked once history
exists, add-only starting amount → first `progress` entry), `goal_entry_sheet.dart`
(progress / withdrawal / correction with confirm), `goal_actions_sheet.dart` (the
overflow: complete, cancel, reopen, archive/unarchive, correct/reverse last
entry). Widgets: `goal_money.dart` (sign-first, LTR, ISO code last),
`goal_progress_bar.dart` (capped, diagonal hatch when over 100%),
`goal_status_pill.dart`, `goal_list_card.dart`. Tab 4 of `home_page.dart` (was a
placeholder).

Goals presentation uses the shared semantic light/dark surfaces: restrained
16px cards and field insets, semantic borders, light-mode subtle shadows,
Playfair Display headings, and Inter tabular/LTR monetary values. The Current
and Archived lists, detail hero/history, action/form/entry sheets, and
empty/error states retain their existing content and action paths; list loading
uses non-animated card-shaped placeholders rather than a text spinner.
The shared sheet header stays above its scrollable fields when the keyboard is
open. Add/Edit Goal keeps the same five type values in a compact horizontally
scrollable 44px chip rail; it does not change their stored identifiers or
validation.
Each mobile goal card keeps a plain semantic surface and renders one compact
Flutter type icon beside its title: home, car, travel, education, or other.
It has no decorative background artwork. Progress bars use the same solid
semantic green fill at every funding level and use the summary's capped display
percentage only for their width; the uncapped percentage and over-target copy
remain visible to the user.
Mobile detail presents Funded and Target side by side only when their card has
enough width; otherwise it stacks them while preserving their full LTR/tabular
money strings. Overfunded copy remains uncapped, while the bar alone clamps to
a completely filled track.

Buttons across Flow 5 share one footprint (Style tile: 52 tall, radius 16):
`PrimaryButton` (filled accent) for Add progress / Save, `SecondaryButton`
(accent 1.5px outline) for Withdraw, `NeutralButton` (field-tint fill + hairline)
for Cancel / Close. An `outlinedButtonTheme` was added to `app_theme.dart` so a
bare `OutlinedButton` matches `FilledButton` app-wide (previously M3 defaults
made an outlined button shorter and rounder than its filled sibling). The detail
hero row is Add / Withdraw / 52×52 ⋯ box.

Tests: `test/goal_math_test.dart` (funded replay incl. reversal, display-percent
cap, surplus) and `test/goal_logic_test.dart` (`validateGoalInput` /
`validateEntryInput` cases, `groupGoalHistoryEntries` correction-chain nesting +
sign inheritance).

### Deviations

- **Goal types:** the canvas chips read "Purchase / Safety / Travel / Education /
  Other"; mobile follows the web/DB type ids (`buy_home`, `buy_car`, `travel`,
  `education`, `other`) with the labels "Buy a home / Buy a car / Travel /
  Education / Other" — a shipping data model outranks a canvas label.
- **List-card inline buttons:** the canvas shows "Unarchive / View history /
  Reopen" inline on archived cards; mobile keeps only Add progress / Withdraw /
  ⋯ inline (active goals) and routes every other action through the ⋯ sheet or
  the detail page, so all writes share one path.
- **History Correct / Reverse:** placed on the ⋯ actions sheet ("Correct last
  entry" / "Reverse last entry"), as on canvas screen 22 — not as per-row links.
  The web page offers per-entry Correct/Reverse on any entry; mobile targets the
  most recent correctable entry.
- **i18n:** English only (matches Flow 1/2; the web Goals strings are localized).

## Deferred

Account/asset links, automatic transaction detection, FX funding, allocation guarantees, and forecasting/on-track logic are outside this MVP.

Mobile-specific: Arabic/RTL copy; reordering/searching the goal list.
