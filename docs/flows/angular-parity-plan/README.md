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
| 2 | 8 | 0/8 | not started |
| 3 | 10 | 10/10 | ✅ complete (`c18a876..2cc674f`) — whole-branch review passed with fixes; Minor sweep deferred to branch finish |
| 4 | 9 | 9/9 | ✅ complete (`bd38aeb..6b416db`) — whole-branch review passed with fixes; retry status text (I2) + tab-switch refetch storm (I8) carried to a follow-up step **4.10**; Minor sweep deferred to branch finish |
| 1b | 9 | 9/9 | ✅ code-complete (`c8c13b5..a886bdb`) — whole-branch review passed with fixes (1 Critical + 3 Important in `a886bdb`); **manual responsive matrix at 360/800/1440 still owed**; DESIGN D9 added (mobile surface mutual-exclusion); Minor sweep + step 4.10 deferred |
| 4.10 | 1 | 0/1 | not started — Phase 4 I2 (attachment-retry status text) + I8 (inspector tab-switch refetch storm; also gate the mobile panel on `inspectorOpened()`) |
| 5 | 7 | 0/7 | not started |
| 6 | 7 | 0/7 | not started |
| 7 | 4 | 0/4 | not started |
| 8 | 6 | 0/6 | not started |
| **Total** | **73** | **49/73** | |
