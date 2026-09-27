# BlueFinWiki React → Angular Conversion — Roadmap

> **For agentic workers:** This is a roadmap, not an executable plan. The per-phase plans below are what you execute. Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans for each phase plan in turn.

**Spec:** `docs/superpowers/specs/2026-05-21-bluefinwiki-react-to-angular-design.md`

**Branch:** `feat/angular-rewrite` (BluefinWiki submodule)

**Approach:** Build the new app in `BluefinWiki/frontend-angular/` alongside the existing React `BluefinWiki/frontend/`. React keeps running locally and in production until the final cutover (Phase 8). Each phase produces an Angular app that builds clean, lints clean, and has its own passing Jest test suite — even though that app isn't yet wired into deployment.

## Cross-phase conventions

These apply to every phase. They're stated here so each phase plan doesn't repeat them.

| Convention | Rule |
|---|---|
| Branch | All work on `feat/angular-rewrite` in the BluefinWiki submodule. Do not branch further. |
| Working directory | `BluefinWiki/frontend-angular/` until Phase 8 swap. |
| Commits | Small and frequent. Each task in a phase plan ends with a commit. Never batch unrelated tasks into one commit. |
| Commit messages | Conventional commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`) — match the existing BluefinWiki history. |
| Style | Angular 20+ standalone components, signals-first, new control flow (`@if`/`@for`/`@switch`), `inject()` DI, functional guards/interceptors. No NgModules. No constructor DI. |
| Tests | Co-located: `foo.component.spec.ts` next to `foo.component.ts`. TDD where practical — write the test first when porting load-bearing logic. |
| Lint | `npm run lint` must be clean before commit. No `// eslint-disable` without a comment explaining why. |
| Type safety | `strict: true` in `tsconfig.json`. No `any` without an inline justification comment. |
| Material only | No Tailwind classes in new templates. Layout via CDK Layout + flex/grid in component SCSS or Material primitives. |
| Markdown text | When porting markdown content, prefer the existing React file's wording verbatim so users see no copy churn. |
| Existing React | Don't touch `BluefinWiki/frontend/` during phases 1–7. It keeps shipping to production. |
| Node version | Match BluefinWiki's repo runtime (Node 22). Confirm with `node --version` ≥ 22.11. |
| PowerShell | Project root is Windows; commands in plans use bash syntax (the dev shell). For Windows-only consumers, the equivalent PowerShell command is provided where it differs meaningfully. |

## Phases

| # | Phase | Plan file | What lands |
|---|---|---|---|
| 1 | Foundation | `2026-05-21-bluefinwiki-react-to-angular-phase-1-foundation.md` | `frontend-angular/` scaffolded; Angular 21 + Material 21; Jest + jest-preset-angular + @testing-library/angular; ESLint with angular-eslint; `proxy.conf.json`; environment-file generation; routing skeleton with placeholder pages; AuthService + Cognito + functional guards + auth/error interceptors; GlobalErrorHandler; OAuth `/callback` component; PermissionGuard directive. CI builds and tests the new app alongside React. |
| 2 | Markdown infrastructure | `2026-05-21-bluefinwiki-react-to-angular-phase-2-markdown.md` | `shared/markdown/` with the ported `remark-wiki-links` + `remark-image-size` plugins, the `unified()` pipeline factory, the `MarkdownRenderer` HAST walker, `WikiLink` and `WikiMermaid` components. `shared/codemirror/wiki-codemirror.component.ts` wrapper around CodeMirror 6 with the existing keymap + `@codemirror/lang-markdown`. All shipped with tests. |
| 3 | Pages MVP | `2026-05-21-bluefinwiki-react-to-angular-phase-3-pages-mvp.md` | `features/pages/`: PagesView, PageTree, PageTreeItem, PageRenameInline, PageEditor (read + save + draft persistence), drag-drop reparent with `cdkDropListEnterPredicate` page-type rules. `core/layout/layout.service.ts` and `features/pages/drafts.service.ts` ported with same localStorage keys. Page view route renders content via the Phase 2 markdown renderer. |
| 4 | Editor extras | `2026-05-21-bluefinwiki-react-to-angular-phase-4-editor-extras.md` | InspectorPanel (mat-sidenav-end + mat-bottom-sheet on mobile), PagePropertiesPanel, CustomPropertiesEditor, AttachmentManager + AttachmentUploader + FileUpload (presigned-URL flow), LinkAutocomplete (mat-autocomplete overlay), MarkdownToolbar, ResizeDivider, EditorErrorBoundary scoped fallback, NewPageModal, CreatePageFromLinkModal, LinkedPagesPanel, PageContextMenu. |
| 5 | Board | `2026-05-21-bluefinwiki-react-to-angular-phase-5-board.md` | `features/board/`: BoardView, BoardColumn (`cdkDropList`), BoardCard (`cdkDrag`), BoardSettingsPanel, CardSummaryDialog. State transitions on drop call `PagesService.updatePage()`; cross-column drag via `cdkDropListConnectedTo`; "Uncategorised" column collects unset state. |
| 6 | Admin | `2026-05-21-bluefinwiki-react-to-angular-phase-6-admin.md` | `features/page-types/` (PageTypesAdmin + service), `features/admin/` (SettingsPage, UserManagement, InvitationManagement, RebuildPageIndex, ProfilePage + services). All gated behind `authGuard` + `adminGuard` except ProfilePage which is auth-only. |
| 7 | Search + AI | `2026-05-21-bluefinwiki-react-to-angular-phase-7-search-ai.md` | `features/search/` (ClientSearchService ported as-is, SearchDialog as mat-dialog opened on Ctrl/Cmd+K). `features/ai/` (AiService, AiInstructionsService, AiContextLoader ported byte-for-byte; AiSidebar, AiButton, ChatMessage, ContextMeter, ActionPreview, InstructionPicker, UnavailableState rebuilt as Material components). `VITE_AI_ALLOW_DESTRUCTIVE` renamed to `NG_APP_AI_ALLOW_DESTRUCTIVE` in env files and workflow. |
| 8 | PWA + cutover | `2026-05-21-bluefinwiki-react-to-angular-phase-8-pwa-cutover.md` | `@angular/pwa` added; `ngsw-config.json` mirrors today's `vite-plugin-pwa` runtimeCaching for `/api/*` (NetworkFirst, 3s timeout, 100 entries, 24h). Aspire `BlueFinWiki.AppHost/Program.cs` updated from `AddViteApp` to `AddNpmApp`. React `frontend/` deleted; `frontend-angular/` renamed to `frontend/`. Home repo workflow `deploy-bluefinwiki.yml` updated: artifact path → `BluefinWiki/frontend/dist/<project>/browser/`; the `NG_APP_*` env var names replace `VITE_*`. Submodule pointer bumped in home repo. Final manual deploy to staging, smoke test, then production. |

## How plans get written and executed

1. Phase 1 plan is written now, alongside this roadmap.
2. After Phase 1 lands (build/lint/test green, smoke verified), the writing-plans skill is invoked again to draft Phase 2.
3. Each subsequent phase plan is drafted after the prior phase lands, so each plan can reflect what was actually learned in the prior phase.
4. Each phase plan is executed via superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.

## Definition of "Phase complete"

A phase is complete when **all** of these are true:

- All tasks in the phase plan are checked off.
- `npm run lint` is clean.
- `npm run build` succeeds with no warnings about unused declarations or missing types.
- `npm test` passes with zero failures and zero skipped tests (`--passWithNoTests` is allowed only in Phase 1's initial scaffold).
- The home repo's `build-frontend-angular` CI job (added in Phase 1, removed in Phase 8 when it becomes the main job) is green on the last push.
- The phase's manual smoke test (defined at the end of each phase plan) passes locally.
