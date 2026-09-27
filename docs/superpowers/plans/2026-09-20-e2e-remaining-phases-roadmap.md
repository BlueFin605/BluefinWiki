# Remaining-Phases E2E Roadmap

> **For agentic workers:** this is an INDEX, not an executable plan. Each
> phase below has its own plan doc under `docs/superpowers/plans/` — open
> that file and follow its own header (REQUIRED SUB-SKILL line included) to
> execute it. Do not try to execute this roadmap file directly.

## Why this exists

Phase 1b's manual 32-item responsive/interaction matrix was replaced by an
automated Playwright suite (`e2e/`, 9 SDD tasks, 34 tests, 4 real product bugs
found — see `.superpowers/sdd/progress-1b-playwright-e2e.md`). The angular
rewrite's status board (`docs/flows/angular-parity-plan/README.md`) still
lists **manual browser walkthroughs owed for Phases 2, 5, 6, 7, 8** — none
automated, same jsdom-can't-verify-real-browser-behavior gap 1b closed. This
roadmap applies 1b's proven pattern (investigate → plan → SDD per spec-file
task → whole-branch review → fix wave) to those five phases.

Per `superpowers:writing-plans`' scope check, five independent subsystems
(tree CRUD, board view, search, AI sidebar, admin/profile) get five separate
plans, not one monolith — each produces working, testable coverage on its
own and can be executed/reviewed independently.

## Investigation basis

Before writing any of the five plans, five parallel investigation agents
read the actual current source (component files, selectors, backend
endpoints, existing jsdom specs) for each phase's exit-criteria items. Their
raw findings aren't re-transcribed here — each phase's own plan cites the
concrete facts it needs inline (file:line, selector, endpoint). Three
findings apply across phases and shaped shared decisions below:

1. **No `page.route()` interception exists anywhere in the current e2e
   suite** (grepped, zero hits) — every existing spec drives the real local
   backend end-to-end. Three of the five new phases need to break that
   pattern deliberately (see "New shared infra" below); this is a real
   precedent-break worth flagging to whoever reviews these plans, not
   something to introduce silently.
2. **The local dev stack has a real Cognito gap.** `disableAuth: true` mode
   (what `npm start` / the e2e stack always runs) skips Cognito entirely for
   *reading* the current user, but backend code that calls AWS Cognito APIs
   directly (`ChangePasswordCommand` in Change Password, `AdminCreateUserCommand`
   in registration) resolves against **LocalStack**, whose `SERVICES` env var
   (`aspire/BlueFinWiki.AppHost/Program.cs`) does not include `cognito` — those
   calls 500 regardless of correctness. This blocks a real-success-path test
   for Phase 8's Change Password and for creating a second real user via the
   UI. Both phase plans route around it (see Phase 8 plan) rather than wait
   on an infra fix that's out of scope here.
3. **No bulk/batch page-create endpoint exists anywhere in `backend/src`.**
   Phase 5's >200-card pagination item needs 200+ individual `POST /pages`
   calls, batched in small concurrent groups (not one-at-a-time, not one
   giant `Promise.all`) to stay under the same backend-concurrency ceiling
   `playwright.config.ts` already caps workers for (its own comment: the
   local Express+LocalStack backend "falls over" under too much concurrent
   load).

## New shared e2e infra (build once, reuse across phases)

| Addition | File | Needed by | Why shared, not per-spec |
|---|---|---|---|
| Sibling-row drag helper (`dragToZone`, top/bottom-quartile aware — extends the existing `dragOnto` pattern in `tree-reparent.spec.ts`, not a copy) | `e2e/tests/helpers.ts` | Phase 2 (items 1, 2), Phase 5 (items 3, 4) | Both phases drive CDK drag-drop against the same class of flakiness (`tree-reparent.spec.ts`'s own doc comment explains the row-swap-preview oscillation); one hardened helper beats two bespoke ones. |
| `mockSearch(page, {results, total})` route-interception helper | `e2e/fixtures/search-mock.ts` (new) | Phase 6 (items 1, 2, 3, 5, 6) | Real search is semantic (Bedrock embeddings), indexing has real lag, ranking isn't exact-match — deterministic pagination/highlighting/rate-limit tests need canned, instant responses. First `page.route()` usage in this suite; written once, reviewed once. |
| `installLanguageModelStub(page, responses)` init-script fixture | `e2e/fixtures/ai.ts` (new) | Phase 7 (all 4 items) | Chrome's on-device Prompt API isn't available in Playwright's bundled Chromium (no Optimization Guide component). Mirrors the exact `globalThis.LanguageModel = {...}` stub every jsdom AI spec already uses — this is a **test-infra addition, not a production code change**. |
| `seedDeletedUser(runId)` — direct DynamoDB `PutCommand` against `bluefinwiki-user-profiles-local` | `e2e/fixtures/admin-users.ts` (new) | Phase 8 (item 3) | `POST /auth/register` can't be used (hard-depends on the same broken Cognito path, item 2 above) — this follows the exact pattern `aspire/scripts/seed-data.js:43-89` already uses to seed users without Cognito. |
| `routeFailure(page, urlPattern, status, body?)` generic failure-injection helper | `e2e/tests/helpers.ts` | Phase 5 (item 3 rollback), Phase 8 (item 3 Retry) | Both need "force this endpoint to fail once" — one helper, two call sites. |

Each phase's own plan has a Task 1 (or an early task) that adds exactly the
infra row(s) it needs — no phase's Task 1 tries to build all five up front,
so a phase can be executed and merged independently of the others landing
first. If two phases land out of order and both add (say) `dragToZone`, the
second one's task becomes "confirm it already exists, skip" — call this out
explicitly in execution, don't silently duplicate.

## Sequencing recommendation

Not a hard dependency order (all five are independent), but a suggested
execution order balancing risk and payoff:

1. **Phase 8 (admin/profile)** — smallest surface, fewest unknowns once the
   Cognito/LocalStack gap is worked around, and directly protects the exact
   regression class (Change Password token header) a prior whole-branch
   review already found once in production code. Good first rep for anyone
   new to this repo's e2e conventions.
2. **Phase 2 (tree CRUD)** — highest-value drag-drop coverage (positional
   reorder + type-constraint blocking), reuses/extends `tree-reparent.spec.ts`'s
   already-proven CDK-drag pattern rather than inventing one from scratch.
3. **Phase 7 (AI sidebar)** — no production-code changes needed at all (rare
   and worth capturing while the investigation is fresh), but introduces the
   `LanguageModel` stub infra other future AI-feature tests will also want.
4. **Phase 5 (board view)** — highest total effort (CDK drag-drop *and*
   route-mocking *and* a >200-card bulk-fixture cost) — most benefits from
   Phase 2's drag helper and Phase 6/7's route-mocking precedent already
   existing in the codebase by the time it's tackled.
5. **Phase 6 (search)** — item 3 (rate limit) is a real 12+ second, must-run-isolated
   test; sequence last so its slower CI wall-clock cost doesn't block earlier,
   faster-landing phases.

Whoever picks this up should feel free to reorder — e.g., if Phase 5 turns
out to be needed for a specific reason, its plan doesn't depend on Phase 2's
having landed, it only *benefits* from the shared drag helper already
existing (and will add it itself if not).

## Per-phase plans

| Phase | Plan doc | Items covered | Items already covered elsewhere (skip) |
|---|---|---|---|
| 2 — Tree CRUD | `2026-09-20-phase-2-tree-crud-e2e.md` | 1, 2, 3, 5, 6, 7 | 4 (rename pre-fill) — `e2e/tests/page-rename.spec.ts` already covers it |
| 5 — Board view | `2026-09-20-phase-5-board-e2e.md` | 1, 2, 3, 4, 5, 6 | none (item 6 partially covered by `board-view-functional.spec.ts`, plan extends it) |
| 6 — Search dialog | `2026-09-20-phase-6-search-e2e.md` | 1, 2, 3, 4, 5, 6 | 7 (visible Search button) — `e2e/tests/search-and-global.spec.ts` items 27/28 already cover it at both breakpoints |
| 7 — AI sidebar | `2026-09-20-phase-7-ai-e2e.md` | 1, 2, 3, 4 | none |
| 8 — Admin/profile | `2026-09-20-phase-8-admin-profile-e2e.md` | 1, 2, 3, 4, 5 | none (item 2's Change Password is covered as a request-shape/regression assertion, not a real-success assertion — see that plan's Task 3 for why) |

## What "done" means per phase

Each phase plan's own final task updates that phase's `README.md` exit
criteria (same pattern 1b used: `[ ]` → `[x]` with a one-line note on what's
automated vs. what stays a documented gap) and, once merged, the top-level
`docs/flows/angular-parity-plan/README.md` status-board row for that phase
should drop "Manual browser walkthrough still owed" the same way commit
`83b70b0` did for Phase 1b. That top-level edit isn't repeated as a task in
every phase plan — do it once, in whichever phase plan lands last, covering
all phases merged so far in one edit (mirrors how 1b's own doc-update task
worked, avoids five near-duplicate diffs to the same table).
