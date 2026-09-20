# Angular Frontend Parity — Remediation Plan

Executable plan to close the gaps recorded in
[`angular-frontend-gap-analysis.md`](../angular-frontend-gap-analysis.md).

Scope: every **🔴 Functional** and **🟠 UX / validation / guard** gap. The **⚪
cosmetic / accepted** list is explicitly out of scope (Material-vs-Tailwind
styling, dark mode, separator glyphs, snackbar-vs-`alert`, debounce 200-vs-300 ms,
page-type property reorder, label wording, `/callback` shell toolbar, coloured
admin badges, "via: link text" vs excerpt, Page ID debug field).

Branch base: `feat/angular-rewrite`. Frontend root: `frontend/` (Angular 21,
standalone, signals + `rxResource`, Jest + `@testing-library/angular`).

---

## Resolved decisions (apply everywhere)

| Ref | Decision |
|---|---|
| **F2** | Tighten to **per-resource invalidation**. Retire the service-wide `_version` bump; mutations invalidate only the resource(s) they affect. See [step 1.2](phase-1-foundations/step-1.2-per-resource-invalidation.md). |
| **F3** | **No dark mode.** Not in scope. Do not reintroduce `dark:` styling or Mermaid theme switching. |
| **F7** | `Authorization` header = `idToken \|\| accessToken`. See [step 0.3](phase-0-auth-shell/step-0.3-auth-token-fallback.md). |
| **F8** | **Drop** local username/password auth. Local dev = `disableAuth: true` only. Remove dead `cognito.endpoint` typing; document in `LOCAL-DEV-GUIDE.md`. See [step 0.4](phase-0-auth-shell/step-0.4-drop-local-userpass-auth.md). |
| **403** | Add `adminGuard` to `/settings` **and** a real `/403` route/component. Guards redirect via `createUrlTree(['/403'])`. See [step 0.6](phase-0-auth-shell/step-0.6-403-route-and-guards.md). |
| **Wiki-links** | Keep click-to-navigate in preview. The pipeline **must always resolve `[[…]]` to a GUID `href`** so a link never dead-ends on a title. See [step 3.8](phase-3-editor-preview/step-3.8-preview-anchor-and-wiki-links.md). |
| **Broken links** | Wire a `pageExists` resolver into the pipeline so broken-link detection **and** the create-from-link flow work end to end. See [steps 2.7](phase-2-tree-crud/step-2.7-create-page-from-link.md) & [3.8](phase-3-editor-preview/step-3.8-preview-anchor-and-wiki-links.md). |
| **F4** | Responsive/mobile layer is carved into its **own design pass** — see [step 1.5](phase-1-foundations/step-1.5-responsive-layer.md). Desktop-first fixes in later phases must not block on it. |
| Testing | **TDD.** Failing test first for every behaviour change, using the existing Jest + Testing Library setup. Logic-heavy units (DnD/`boardOrder` maths, auth coalescing, pipeline plugins, `group-by-state`, rate limiter, TOC parser) get thorough unit coverage; component wiring gets Testing Library integration tests. |

---

## Phases

Foundations first: Phases 0–1 unblock the rest. Phases 2–8 are largely
independent of each other and can run in parallel once 0–1 land.

| Phase | Theme | Depends on | File |
|---|---|---|---|
| **0** | Auth & app-shell correctness | — | [phase-0-auth-shell/](phase-0-auth-shell/README.md) |
| **1** | Cross-cutting enablers | 0 | [phase-1-foundations/](phase-1-foundations/README.md) |
| **2** | Page tree & CRUD | 1 (`PageTypes` wiring) | [phase-2-tree-crud/](phase-2-tree-crud/README.md) |
| **3** | Editor & preview | 1 (layout store) | [phase-3-editor-preview/](phase-3-editor-preview/README.md) |
| **4** | Inspector | 1, 3.7 (authed images) | [phase-4-inspector/](phase-4-inspector/README.md) |
| **1b** | Responsive / mobile layer (F4) | 1, **3, 4** | [phase-1b-responsive/](phase-1b-responsive/README.md) |
| **5** | Board view | 1 (`PageTypes` wiring) | [phase-5-board/](phase-5-board/README.md) |
| **6** | Search dialog | 1.5→1b (mobile bar, soft) | [phase-6-search/](phase-6-search/README.md) |
| **7** | AI sidebar | 1.2 (invalidation) | [phase-7-ai/](phase-7-ai/README.md) |
| **8** | Admin & profile polish | 0.6 (403) | [phase-8-admin-profile/](phase-8-admin-profile/README.md) |

Phase **1b** is numbered out of order deliberately: it is designed up front
(see [`phase-1b-responsive/DESIGN.md`](phase-1b-responsive/DESIGN.md)) but
**executes after Phases 3 and 4**, because it refactors `page-detail` /
`pages-view` and should wrap them once they are feature-complete. The
mobile-tagged acceptance criteria in Phases 3 / 4 / 6 are ticked in 1b.

### Dependency graph

```
Phase 0 ──► Phase 1 ──┬──► Phase 2
                      ├──► Phase 3 ──► Phase 4 ──► Phase 1b (responsive)
                      ├──► Phase 5
                      ├──► Phase 6
                      ├──► Phase 7
                      └──► Phase 8
step 1.1 (PageTypes) ──► 2.2, 2.4, 2.6, 4.4, 5.1, 5.5, 5.7
step 1.3 (layout)    ──► 3.1 (split position), 4.1 (inspector width/visible)
step 3.7 (authed img)──► 4.8 (thumbnails/lightbox)
Phase 1b (F4)        ──► mobile variants in 3.4, 3.5, 3.10, 4.1, 6.7
                         (those steps ship desktop-first; 1b completes them)
```

---

## How to execute with agents

1. Pick a phase. Read its `README.md` for order and shared context.
2. Dispatch **one agent per step file**, in the order the phase README gives.
   Steps within a phase marked "parallel-safe" can be dispatched together.
3. Each agent must:
   - Read the step file **and** the referenced gap-analysis section(s).
   - Follow TDD: write the failing test(s) first, then implement.
   - Run `npm test` and `npm run lint` in `frontend/` before reporting done.
   - Report against the step's **Acceptance criteria** checklist.
4. After each step, tick its box in the phase README status table.
5. Close a phase only when its **Phase exit criteria** all pass.

Each step file is self-contained: problem, target behaviour, files, tests,
acceptance criteria, out-of-scope. Where a step says "verify against the
backend", that verification is part of the step.

---

## Status board

| Phase | Steps | Done | State |
|---|---|---|---|
| 0 | 7 | 7/7 | ✅ complete (branch `feat/angular-rewrite`) — CI prod-build wiring deferred (FOLLOWUP) |
| 1 | 5 | 5/5 | ✅ complete (`529e35a..adb5860`) — 1.5 design-only, code is 1b |
| 2 | 8 | 8/8 | ✅ code-complete (`5426b70..d64052b`) — whole-branch review found 1 Critical + 5 Important, all fixed + re-reviewed clean (ready to merge: yes); **manual browser walkthrough still owed**; touch drag-drop positional reorder is a known gap (desktop mouse unaffected) |
| 3 | 10 | 10/10 | ✅ complete (`c18a876..2cc674f`) — whole-branch review passed with fixes; Minor sweep deferred to branch finish |
| 4 | 9 | 9/9 | ✅ complete (`bd38aeb..6b416db`) — whole-branch review passed with fixes; retry status text (I2) + tab-switch refetch storm (I8) carried to a follow-up step **4.10**; Minor sweep deferred to branch finish |
| 1b | 9 | 9/9 | ✅ code-complete + manual matrix automated (`c8c13b5..a886bdb`) — whole-branch review passed with fixes (1 Critical + 3 Important in `a886bdb`); **manual-matrix-to-Playwright replacement** via `e2e/tests/{stacking-paint-order,inspector-sheet,tree-drawer,editor-toolbar,toc-breadcrumbs,search-and-global}.spec.ts` (34 tests, all passing; see `docs/superpowers/specs/2026-09-19-phase-1b-playwright-e2e-design.md` for design); DESIGN D9 added (mobile surface mutual-exclusion); Minor sweep + step 4.10 deferred |
| 4.10 | 1 | 1/1 | ✅ complete (`e040c42..e2ada7b`) — I2 visible retry status (role=status, "attempt N of 9") + I8 (*matTabContent+preserveContent kills tab-bounce refetch; pages-view panel gated on inspectorOpened() kills eager mobile mount) |
| 5 | 7 | 7/7 | ✅ code-complete (`a380e3c..dc1be02`) — whole-branch review found 1 Critical + 7 Important; fix wave 1 (Critical + 6 Important) introduced a new Critical regression (`boardEligible()` flicker ejecting users from board view on their own first drag), fixed in fix wave 2 (root-caused to a `linkedSignal` retention fix); final re-review: ready to merge, independently re-verified (99 suites / 1020 tests). 1 Important (generation-guard timing on parent-change during Load-more) and 1 pre-existing page-resource-reload wart left as documented debt (not a Phase 5 regression); **manual browser walkthrough still owed** (like every phase before it) |
| 6 | 7 | 7/7 | ✅ code-complete (`de32dee..bfe4f05`) — whole-branch review found 0 Critical + 2 Important (stale-snapshot `onLoadMore()` merge/dispatch race; rate-limit banner never announced via `aria-live`); fix wave (`bfe4f05`) resolved both structurally (pre-dispatch guard against the displayed snapshot; `liveMessage` mirrors the banner's own condition); re-review independently verified both (reverted/reran to confirm RED→GREEN, reran full suite itself): **ready to merge, yes** (103 suites / 1116 tests, lint clean). 5 Minors left as documented debt; **manual browser walkthrough still owed** (like every phase before it) |
| 7 | 4 | 4/4 | ✅ code-complete (`4356029..74eda99`) — whole-branch review found 0 Critical + 4 Important (an async action-completion race between step 7.1's lifecycle and step 7.2's turn finalization; a superseded pending action left rendering "Reviewing proposed change…" forever; instruction lock not gated on the send itself succeeding, only its content fetch; the instruction picker's Create button reaching a pre-existing page-creation path with zero invalidation); one fix wave (`74eda99`) resolved all 4, re-review independently verified each against the code (not the report) and traced cross-finding interactions: **ready to merge, yes** (1178/1178 tests, lint + tsc clean). Several Minors left as documented debt; **manual browser walkthrough still owed** (like every phase before it) |
| 8 | 6 | 6/6 | ✅ code-complete (`868e616..fe4b1f9`) — 6 steps (back nav; profile display-name; profile change-password; members Edit-disabled+Retry; invitations pills+validation+banner; rebuild-index confirm gate+orphan list), each task-reviewed clean (0 Critical/Important). Whole-branch review found 2 Critical spanning the seam BELOW the frontend diff — Change Password sent Cognito the wrong token kind (ID token instead of access token, pre-existing backend code from an earlier "permissions implementation" commit made reachable for the first time by this phase's new UI, always rejecting a correct password) and the shared `error-interceptor.ts` never read the backend's actual `{error:...}` envelope shape (only `{message:...}`), so server error messages never reached the UI, defeating 8.2/8.3's own acceptance criteria — plus 1 Important (no test exercised the real error pipeline). User chose the fix approach for the token issue (a dedicated `X-Access-Token` header, `Authorization`/ID-token auth left untouched) over 3 alternatives presented. One fix wave (`fe4b1f9`) resolved all 3; re-review (opus) independently verified end-to-end — traced `getAccessToken()`'s real return value, confirmed `withAuth`/API-Gateway Cognito authorization still gates the endpoint, confirmed the new regression test would genuinely have failed pre-fix: **ready to merge, yes** (108 suites / 1206 frontend tests, 193 backend tests, lint+tsc clean). 6 Minors left as documented debt (a stale-access-token-on-401-retry edge, self-healing on retry; one CORS gateway-response header list left inconsistent with its sibling; a test missing an `afterEach` reset; an unverified same-origin topology claim in the fix report; a header helper imported from an unrelated module; a pre-existing raw-exception-text leak on 5xx now more reachable). **Manual-walkthrough debt closed** via `e2e/tests/{admin-back-nav,profile-forms,members-admin,invitations-admin,rebuild-index-confirm}.spec.ts` (14 tests, all passing; see `docs/superpowers/plans/2026-09-20-phase-8-admin-profile-e2e.md`). |
| **Total** | **73** | **73/73** | Angular-rewrite parity plan code-complete across all 10 phases + the 4.10 follow-up (recomputed directly from this table's own Done column, 2026-09-19). Manual browser walkthroughs remain owed for Phases 2, 5, 6, 7 (Phase 1b's manual matrix replaced by automated Playwright suite; Phase 8's closed the same way) — none run yet for these, jsdom cannot verify real pointer/CDK/responsive/browser behavior. |
