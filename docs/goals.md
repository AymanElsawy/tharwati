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

The protected `/goals` route provides current and archived lists, Add/Edit Goal, details, Add Progress, Withdraw, Correct, Reverse, Complete, Cancel, Reopen, Archive, and Unarchive. New goals default their currency selector to the authenticated profile's `base_currency_code`, while edits retain the goal's stored currency. Details show the truthful funded amount, target, uncapped percentage, target date, status, and full chronological immutable history. Correction chains are visually grouped beneath their original entry. The original, the recorded correction or reversal, and any updated entry have distinct plain-language labels while the audit explanation remains secondary. Goal money presents the signed amount before the currency (for example, `−500,000 EGP`) in an LTR-isolated span for stable English and Arabic/RTL rendering. Add Progress and Withdraw remain primary actions; lifecycle and archive actions collapse into an overflow menu on narrow screens. English and Arabic cover all Goals labels, validation, confirmation, and error states. The forms and domain/service layer are responsive and reusable by a future mobile client.

## Deferred

Account/asset links, automatic transaction detection, FX funding, Dashboard Goal cards, allocation guarantees, and forecasting/on-track logic are outside this MVP.
