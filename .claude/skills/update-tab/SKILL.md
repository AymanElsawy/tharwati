---
name: update-tab
description: Use when the user asks to change, add, or fix something in a specific app tab/feature (e.g. "accounts", "dashboard") — finds the matching docs/<tab>.md spec, implements the code change, updates the Supabase schema/migration if the DB is affected, and always ends by syncing docs/<tab>.md so it never drifts from the code.
---

# Update Tab

Keeps `docs/<tab>.md` as the source of truth for a feature while making a requested
change. Every run must end with the doc updated — that's the non-negotiable part.

## Workflow

1. **Identify the tab.** Map the user's request to a feature name (e.g. "accounts",
   "dashboard", "portfolio"). Confirm the doc exists at `docs/<tab>.md` (run
   `ls docs/` if unsure of exact filename/casing). If no doc exists for a tab that
   clearly should have one, say so before proceeding — don't silently invent a new
   doc structure.

2. **Read before writing.** Read the full `docs/<tab>.md` and the corresponding
   feature code at `src/features/<tab>/` (repositories, schemas, hooks, components,
   pages). The doc describes data model, validation, business logic, and UI/UX flow —
   use it to understand current behavior before changing it, and to know which
   sections will need updating after.

3. **Implement the requested change** in the feature code, following existing
   conventions in that feature folder (repository pattern, Zod schemas, decimal-safe
   math for money/quantity fields, i18n keys in `src/i18n/{en,ar}/translations.ts`
   rather than hardcoded strings, RTL-aware layout).

4. **If the change touches the database** (new/changed column, table, constraint,
   RLS policy, trigger, or RPC):
   - Load the `supabase-postgres-best-practices` skill before writing any SQL.
   - Add a new migration file under `supabase/migrations/`, named
     `YYYYMMDDHHMMSS_short_description.sql` (use current UTC timestamp; check the
     latest existing filename in that folder so the new one sorts after it).
   - Never edit a migration that's already been applied/committed — add a new one.
   - If an Edge Function under `supabase/functions/` needs to change to match, update
     it in the same pass.
   - Update the corresponding TypeScript types/repository methods so client code
     matches the new schema exactly (column names, nullability, RPC signature).

5. **Update `docs/<tab>.md` to match reality.** This step is mandatory even for
   small changes. Edit only the sections affected — don't rewrite the whole doc:
   - Schema/table definitions (§ data model) if columns, constraints, or RPCs changed.
   - Validation rules table if field requirements changed.
   - Business logic section if create/update/archive/delete behavior changed.
   - Repository/API surface if method signatures changed.
   - UI/UX flow section if screens, fields, or interactions changed.
   - "Notable quirks / deviations" section: add an entry if the change introduces a
     deliberate deviation worth flagging, or remove an entry if this change fixes a
     previously-documented quirk.

6. **Verify.** Run the project's typecheck/lint/tests for the touched files (check
   `package.json` scripts). If a migration was added and the Supabase CLI is
   available and authenticated, note that `supabase db push` / local `db reset` would
   apply it — don't run destructive DB commands without the user's go-ahead.

7. **Report** what changed in code, what (if anything) changed in the DB/migrations,
   and which doc sections were updated — so the user can confirm the doc still reads
   correctly.

## Notes

- Treat `docs/<tab>.md` as living documentation, not a changelog — write it in the
  present tense describing current behavior, not "we changed X to Y".
- Keep monetary/quantity fields as decimal strings end-to-end (this codebase avoids
  native floats for money) — reflect that in both code and doc if you touch such a
  field.
- If a requested change conflicts with something the doc explicitly flags as a
  deliberate, documented deviation, point that out to the user rather than silently
  "fixing" it.
