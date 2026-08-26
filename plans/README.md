# Implementation Plans

`docs/<tab>.md` is the current source of truth for each product tab.
`plans/<feature>.md` is the concise, implementation-ready plan for work that is not yet complete.

Plans are not design essays. Each plan contains only:

1. Goal
2. Current relevant state
3. Scope
4. Business/financial rules
5. DB/API contract, if applicable
6. Expected files/areas
7. Acceptance criteria
8. Required tests
9. Explicit non-goals

## Workflow

1. Diagnose only when the documented current state is insufficient.
2. Write or update `plans/<feature>.md` before implementation.
3. Delegate suitable implementation work to GitHub Copilot through the delegate skill when that capability is available.
4. The delegate implements the plan, focused tests, translations, and the relevant `docs/<tab>.md` sync.
5. Codex reviews the resulting diff rather than reimplementing it.
6. Codex changes only real blockers or sensitive issues.
7. Run the smallest relevant validation set.
8. For safe completed work, combine deploy, smoke test, commit, and push in one run.

Do not let Codex and a delegate edit the same feature concurrently. Do not repeat diagnostics already captured in documentation or a current plan. Keep all work mobile-app-ready and decimal-safe.

## Delegation Boundary

Delegate UI, responsive behavior, routine services/repositories, translations, normal focused tests, and documentation sync when suitable.

Codex retains implementation and review control for financial calculations, migrations/RPCs, RLS/Auth/security, concurrency, destructive changes, and deployment decisions.
