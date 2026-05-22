# React → Angular Conversion — Phase 7: Search + AI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-05-21-bluefinwiki-react-to-angular-design.md`
**Roadmap:** `docs/superpowers/plans/2026-05-21-bluefinwiki-react-to-angular-roadmap.md`
**Branch:** `feat/angular-rewrite` (continues from local tag `phase-6-admin`, commit `f1a3028`).
**Working directory:** `BluefinWiki/frontend-angular/`.

**Goal:** Bring the wiki to feature parity with React's two final surfaces — semantic search (Ctrl/Cmd+K dialog over `/api/search`) and the AI sidebar (Chrome Prompt API + tool-using JSON action protocol). The three framework-agnostic AI services port byte-for-byte; only the UI gets rebuilt as Material. After Phase 7, the only thing standing between the Angular app and production is Phase 8's PWA + cutover.

**Architecture:**
- **Search:** `Search` service is a thin HttpClient wrapper around `GET /api/search?q=...&scope=...&limit=...&offset=...`. `SearchDialog` is a `mat-dialog` opened on Ctrl/Cmd+K (global `document` keydown listener owned by `PagesView`). Results list scopes + filters port from React's `SearchDialog.tsx`.
- **AI:** Three framework-agnostic TypeScript modules port verbatim (`AiService`, `AiInstructionsService`, `AiContextLoader`) plus the `aiDebug` utility. The only Angular touch points: read the `aiAllowDestructive` flag from `environment.ts` (already exists from Phase 1) instead of `import.meta.env.VITE_AI_ALLOW_DESTRUCTIVE`, and swap `apiClient` → `HttpClient`. Expose `messages`, `inputUsage`, `inputQuota`, `streaming`, `currentAction` as signals (vs React's `useReducer` state) — wrap the existing implementation rather than rewrite.
- **AI UI:** `<wiki-ai-button>` toggles `<wiki-ai-sidebar>` (a right-side `<mat-sidenav>`). Inside the sidebar: `<wiki-instruction-picker>` (a `mat-select` of available presets), `<wiki-chat-message>` (one per message), `<wiki-context-meter>` (`mat-progress-bar` of inputUsage/inputQuota), `<wiki-action-preview>` (when `currentAction` is non-null, render the proposed action with Accept/Reject), `<wiki-unavailable-state>` (fallback when `'LanguageModel' in window` is false).

**Spec → plan adjustments:**
- Per the spec: `VITE_AI_ALLOW_DESTRUCTIVE` → `NG_APP_AI_ALLOW_DESTRUCTIVE` in env vars and workflow. Phase 1's `environment.ts` already exposes `aiAllowDestructive: boolean`. Phase 7 reads `environment.aiAllowDestructive` and threads it through the ported `AiService`.
- The Chrome Prompt API surface (`window.LanguageModel`) is unmocked in jsdom. Tests for `AiService` stub `globalThis.LanguageModel` with a fake that fulfills the contract (matches the React Vitest setup). Phase 7's spec calls this out.
- We **do not** port React's `useAi.ts` hook — it's React-specific glue. The new Angular components consume `AiService` signals directly.

**Cross-phase reminders:** Local-only. Angular 21 zoneless testing patterns per `feedback_angular_21_zoneless_testing` (now 14+ entries).

---

## Task 1: `Search` service + `SearchScope`/`SearchResult` types

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/search/search.types.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/search/search.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/search/search.spec.ts`

Port `BluefinWiki/frontend/src/types/search.ts` (just types) and `BluefinWiki/frontend/src/services/ClientSearchService.ts` (52 lines, thin HTTP wrapper).

API:
```ts
@Injectable({ providedIn: 'root' })
export class Search {
  search(query: WikiSearchQuery): Promise<WikiSearchResultSet>;
}
```

Sanitize input (slice to 500, strip `<>`, trim) — match React behaviour. On empty input, return empty result without hitting the API.

Tests (~4): sends `q`, `scope`, `limit`, `offset` query params; sanitises angle brackets and length; returns empty for blank input; surfaces HTTP errors with the status.

- [ ] Spec + implement + `git commit -m "feat(angular): Search service over /api/search"`

---

## Task 2: `<wiki-search-dialog>` (Ctrl+K)

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/search/search-dialog.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/search/search-dialog.spec.ts`
- Modify: `BluefinWiki/frontend-angular/src/app/features/pages/pages-view.ts` — add `@HostListener('window:keydown')` to open the dialog on Ctrl/Cmd+K
- Modify: `BluefinWiki/frontend-angular/src/app/features/pages/pages-view.spec.ts`

Material dialog with:
- Search input (debounced 200ms via toObservable + debounceTime + toSignal — same pattern as Phase 4's `LinkAutocomplete`)
- Scope toggle (`mat-button-toggle-group`: All / Page titles / Page content)
- Results list — each result has title, breadcrumb path, snippet, click navigates to `/pages/:guid` and closes
- Loading state, empty state, error state

API: dialog opens with no data; close emits the chosen page guid (or null).

For Phase 7 we **do not** port React's "recent history" pinned list — it's a polish task that can land later.

`PagesView` wires `(window:keydown)` to detect `(e.metaKey || e.ctrlKey) && e.key === 'k'` → `dialog.open(SearchDialog)`. Preventing the default browser shortcut is critical.

Tests (~5):
- typing fires search after debounce
- scope toggle changes the request
- empty input shows empty state without hitting API
- clicking a result navigates and closes
- Ctrl+K opens the dialog from PagesView

- [ ] Spec + implement + wire + `git commit -m "feat(angular): SearchDialog with Ctrl/Cmd+K trigger"`

---

## Task 3: `aiDebug` utility port

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/ai/ai-debug.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/ai/ai-debug.spec.ts`

Port `BluefinWiki/frontend/src/utils/aiDebug.ts` (small, framework-agnostic). Exports `aiDebug`, `aiNow`, `aiElapsedMs`. Gating typically reads `localStorage.getItem('ai.debug') === 'true'` — port verbatim.

Tests (~3): respects localStorage gating, aiNow returns a number, aiElapsedMs subtracts.

- [ ] Spec + implement + `git commit -m "feat(angular): port aiDebug utility"`

---

## Task 4: `AiInstructions` service port

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/ai/ai-instructions.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/ai/ai-instructions.spec.ts`

Port `BluefinWiki/frontend/src/services/AiInstructionsService.ts` (81 lines). Wrap as `@Injectable({ providedIn: 'root' })` but keep the data shapes and method bodies the same.

Tests (~3): default instructions return as expected, switching instruction key applies the right preset, custom instruction text round-trips through localStorage if applicable.

- [ ] Spec + implement + `git commit -m "feat(angular): port AiInstructions service"`

---

## Task 5: `AiContextLoader` service port

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/ai/ai-context-loader.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/ai/ai-context-loader.spec.ts`

Port `BluefinWiki/frontend/src/services/AiContextLoader.ts` (133 lines). Replace any direct `apiClient` usage with `inject(HttpClient)`. Replace `localStorage` access patterns unchanged.

Tests (~4): builds context for a given page (current page + related pages + page types), respects the depth/limit knobs, surfaces errors when /api fails.

- [ ] Spec + implement + `git commit -m "feat(angular): port AiContextLoader service"`

---

## Task 6: `Ai` service port (Chrome Prompt API)

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/ai/ai.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/ai/ai.spec.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/ai/prompt-api.d.ts` — copy from React's `types/prompt-api.d.ts`

Port `BluefinWiki/frontend/src/services/AiService.ts` (273 lines). The substantive changes:

1. `const ALLOW_DESTRUCTIVE = import.meta.env.VITE_AI_ALLOW_DESTRUCTIVE !== 'false';` → `const ALLOW_DESTRUCTIVE = environment.aiAllowDestructive;` (read from `environments/environment.ts`).
2. Wrap in `@Injectable({ providedIn: 'root' })`.
3. Replace internal `useReducer`-style state with Angular signals:
   - `messages = signal<ChatMessage[]>([])`
   - `inputUsage = signal<number>(0)`
   - `inputQuota = signal<number>(0)`
   - `streaming = signal<boolean>(false)`
   - `currentAction = signal<ProposedAction | null>(null)`
4. Methods stay the same: `start`, `sendMessage`, `acceptAction`, `rejectAction`, `reset`, `isAvailable()`.

Tests (~6): isAvailable returns false when `LanguageModel` undefined, returns true when stubbed, sendMessage updates messages signal and parses action JSON, ALLOW_DESTRUCTIVE=false strips delete/move from schema (verify the resulting schema doesn't include those types), acceptAction calls the registered action handler, rejectAction clears currentAction.

Use a `LanguageModel` stub similar to React's Vitest setup — see `frontend/src/services/__tests__/AiService.test.ts` for the existing pattern.

- [ ] Spec + implement + `git commit -m "feat(angular): port AiService with signal-backed state"`

---

## Task 7: AI UI primitives — `<wiki-ai-button>`, `<wiki-unavailable-state>`, `<wiki-chat-message>`, `<wiki-context-meter>`

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/ai/ai-button.ts` + spec
- Create: `BluefinWiki/frontend-angular/src/app/features/ai/unavailable-state.ts` + spec
- Create: `BluefinWiki/frontend-angular/src/app/features/ai/chat-message.ts` + spec
- Create: `BluefinWiki/frontend-angular/src/app/features/ai/context-meter.ts` + spec

**ai-button:** `mat-icon-button` with `psychology` icon. Output `(toggled)`. Disabled when `Ai.isAvailable() === false`.

**unavailable-state:** Static message with link to Chrome Origin Trial / chrome://flags. Shown inside the sidebar when AI is unavailable.

**chat-message:** Renders one message — role (user / assistant) styled differently. Renders content as markdown via `<wiki-markdown-renderer>` for assistant messages, plain text for user. Show timestamp on hover.

**context-meter:** `mat-progress-bar [value]="100 * usage / quota"`. Tooltip shows `usage / quota` numerically.

Tests (~3 each, ~12 total).

- [ ] Spec + implement each + `git commit -m "feat(angular): AI UI primitives (button, unavailable, chat message, context meter)"`

---

## Task 8: `<wiki-action-preview>` + `<wiki-instruction-picker>`

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/ai/action-preview.ts` + spec
- Create: `BluefinWiki/frontend-angular/src/app/features/ai/instruction-picker.ts` + spec

**action-preview:** When `Ai.currentAction()` is non-null, render the proposed action with field-by-field display + Accept + Reject buttons. Different layouts per action.type (create_page, update_page, delete_page, move_page, fetch_url, fetch_imdb_show). Accept calls `ai.acceptAction()`; Reject calls `ai.rejectAction()`.

**instruction-picker:** `mat-select` of available instructions from `AiInstructions.list()`. Selection calls `aiInstructions.setActive(key)`.

Tests (~4 each).

- [ ] Spec + implement + `git commit -m "feat(angular): ActionPreview + InstructionPicker"`

---

## Task 9: `<wiki-ai-sidebar>` (composes everything)

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/ai/ai-sidebar.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/ai/ai-sidebar.spec.ts`

Composes:
- `<mat-toolbar>` with title + close button + InstructionPicker
- `<wiki-context-meter>` near the top
- Scrollable messages area: `@for (m of ai.messages(); track $index) { <wiki-chat-message [message]="m" /> }`
- `<wiki-action-preview>` (renders when `ai.currentAction()` non-null)
- Input bar at the bottom with text input + send button. Submit calls `ai.sendMessage(value)`. Disabled while `ai.streaming()` is true.

When `Ai.isAvailable()` is false, swap the body for `<wiki-unavailable-state>`.

Tests (~4): renders messages, sending text calls Ai.sendMessage, streaming flag disables send, unavailable state renders when isAvailable() false.

- [ ] Spec + implement + `git commit -m "feat(angular): AiSidebar composed UI"`

---

## Task 10: Wire AI button into `PagesView`

**Files:**
- Modify: `BluefinWiki/frontend-angular/src/app/features/pages/pages-view.ts`
- Modify: `BluefinWiki/frontend-angular/src/app/features/pages/pages-view.spec.ts`

Add `<wiki-ai-button>` to the toolbar (next to "New page"). Toggle reveals/hides `<wiki-ai-sidebar>` wrapped in a `mat-sidenav` pinned right.

Light test (~1 new): button toggles sidebar.

- [ ] Implement + `git commit -m "feat(angular): wire AI sidebar into PagesView"`

---

## Task 11: Local smoke + Phase 7 exit gate

**Files:** no source changes.

- [ ] **Step 1:** `cd BluefinWiki/frontend-angular && npm run lint && npm test && npm run build && npm run build:prod`
- [ ] **Step 2:** Optional manual smoke (deferred to user if non-interactive): Ctrl+K opens SearchDialog, search returns results, click navigates. AI button reveals sidebar; if Chrome AI is available, send a "summarise this page" message → action preview appears.
- [ ] **Step 3:** Tag locally: `git -C BluefinWiki tag phase-7-search-ai`. **Do not push.**

---

## What's next

Phase 8: PWA + cutover. Add `@angular/pwa`, mirror today's `vite-plugin-pwa` runtimeCaching in `ngsw-config.json`, swap the Aspire AppHost from `AddViteApp` to `AddNpmApp`, **delete `frontend/`** and rename `frontend-angular/` → `frontend/`. Per Dean's local-only constraint, **skip** the home-repo workflow edits + final S3 deploy + smoke test in staging/production — those land when Dean manually pushes after the local cutover is verified.
