# BluefinWiki Frontend: React → Angular Conversion — Design

**Status:** Approved — ready for implementation plan
**Date:** 2026-05-21
**Author:** Dean Mitchell + Claude (brainstorming session)

## Goal

Convert the BluefinWiki SPA from React to Angular. This brings BluefinWiki onto the BlueFin605 standard frontend stack (Angular SPA, per `bluefin-dev`), matching Chess and any future BlueFin frontend.

## Non-goals

- Backend changes. Lambda handlers, API contracts, DynamoDB schema, S3 layout, Cognito setup are all unchanged.
- CDK infrastructure changes. Same S3 bucket, same CloudFront distribution, same Cognito wiring.
- Feature additions. The Angular app delivers the same feature set as React on cutover day. New features happen post-port.
- Design refresh. Visual changes are limited to what Material requires (component primitives change shape). No new colour scheme, no copy rework.

## Decisions and reasoning

The design below is the product of a structured Q&A. The decisions and the rationale behind each are captured here so future-me can tell whether each choice still holds.

### Migration strategy — big bang on a branch

A feature branch (`feat/angular-rewrite` in the BluefinWiki submodule) holds the work. The new app is built in `frontend-angular/` alongside `frontend/` so both apps coexist during development — React keeps building and running locally for A/B comparison. The final commits delete `frontend/` and rename `frontend-angular/` → `frontend/`, update the GitHub Actions workflow paths in the home repo, and update the Aspire AppHost wiring. One PR ships.

**Rejected**: route-by-route incremental migration (Module Federation or iframe). For a ~16K-LOC family-scale app maintained by one person, the plumbing cost dwarfs the benefit. There's no production traffic that would be hurt by a single-shot cutover.

**Rejected**: replace `frontend/` in place from day one. Cleaner history but no fallback to compare against while building. The branch is non-functional for weeks, which makes any pause-and-resume harder.

### Framework version and style — Angular 20+, signals-first standalone

Modern idiomatic Angular: standalone components (no NgModules), signals for component state, new control flow (`@if`/`@for`/`@switch`), `inject()` over constructor DI, functional route guards/interceptors. This matches the way the Angular team is steering the framework and matches the trajectory of Chess (the other BlueFin605 Angular project).

**Rejected**: NgModules + RxJS-everywhere. Stable but writing legacy patterns in 2026 against Google's documented direction.

### UI and styling — Angular Material, drop Tailwind

Use Angular Material as the single design system. Material 3 theming via `mat.theme()`. Drop Tailwind 4 entirely; layout via Angular CDK Layout + Flex/Grid utilities; spacing/typography from Material tokens.

This is a bigger migration cost than "keep Tailwind" (every utility class in templates is rewritten) but the result is a single coherent design system rather than a Material + Tailwind hybrid with two competing systems of tokens and spacing.

**Rejected**: keep Tailwind for layout utilities alongside Material. Lower migration friction but two design systems forever.

**Rejected**: keep Tailwind, no component library. Lowest visual churn but more hand-rolled components forever (dialogs, menus, autocomplete overlays, sidenav drawers); these are where Material genuinely pays off.

### Data fetching — Angular `resource()` / `rxResource()`

Replace TanStack Query with Angular's `resource()` / `rxResource()` primitives. These tie async data directly to signal-based reactivity: when a request signal changes, the loader reruns; the result is exposed as `value()` / `isLoading()` / `error()` signals.

The current TanStack Query setup runs with caching disabled (`staleTime: 0`, `gcTime: 0`), so we're not losing a feature we depend on. `resource()` matches that no-cache behaviour by default while also matching the rest of the Angular signal-based design.

**Rejected**: plain `HttpClient` + service caching. Workable but means each service hand-rolls "loading/error/value" tracking that `resource()` standardises.

**Rejected**: `@tanstack/angular-query`. Same API shape as today but adds a non-stdlib dependency for caching we don't use.

### Auth — keep `amazon-cognito-identity-js`

Keep the existing `amazon-cognito-identity-js` library plus the custom OAuth 2.0 PKCE helpers in `utils/cognitoAuth.ts`. Wrap them in an `AuthService` (signals: `isAuthenticated`, `user`, `roles`) plus a functional `authGuard`, `adminGuard`, and `authInterceptor`.

The current auth code works. The Hosted UI integration is already debugged. There's nothing to gain by swapping to `angular-auth-oidc-client` or Amplify Auth except a new library to keep up-to-date.

**Rejected**: `angular-auth-oidc-client`, `@aws-amplify/auth`. Both viable but unwarranted churn given working code.

### Markdown editor — CodeMirror 6 in an Angular wrapper

CodeMirror 6 is framework-agnostic. Wrap it in a standalone `<wiki-codemirror>` component that creates an `EditorView` on init, exposes `value` / `change` as a `model()` signal pair, applies the existing keymap + `@codemirror/lang-markdown` + history + commands extensions. Preserve every keyboard shortcut and command.

**Rejected**: Monaco editor. Heavier bundle (~3MB), more features than needed for markdown, loses today's keymap.

**Rejected**: plain `<textarea>`. Loses syntax highlighting and line management; the editor is core UX.

### Markdown rendering — keep unified/remark/rehype pipeline

Drop `react-markdown`. Call `unified()` directly with the same plugin set:
- `remark-gfm`
- `remark-breaks`
- `rehype-highlight`
- custom `remarkWikiLinks` (ported as-is)
- custom `remarkImageSize` (ported as-is)

Render the produced HAST tree via an Angular `MarkdownRendererComponent` that walks nodes recursively and emits Angular templates. Wiki-link nodes become `<wiki-link>` components (red broken-link or live link with autocomplete-aware behaviour); mermaid code-block nodes become `<wiki-mermaid>` components; everything else is standard HTML rendered through trusted Angular templates (no `[innerHTML]` for app-controlled nodes).

**Rejected**: `marked` + custom Angular renderer. Smaller bundle but re-implements the wiki-link plugin behaviour.

**Rejected**: `ngx-markdown`. Same issue (wraps `marked`, loses the remark plugins).

### Drag-and-drop — Angular CDK DragDrop

Use `@angular/cdk/drag-drop` for both the page tree (`cdkDrag` items inside `cdkDropList` containers, free reparenting with `cdkDropListEnterPredicate` enforcing page-type hierarchy rules) and the Kanban board (`cdkDropList` columns linked via `cdkDropListConnectedTo`, `cdkDrag` cards). First-party, well-documented, supports the constraint patterns we need.

**Rejected**: native HTML5 drag-and-drop. Cross-browser quirks, accessibility footguns, hand-rolled reorder/constraint logic each spot.

### Test runner — Jest with `jest-preset-angular`

Jest is the long-established community standard for Angular unit testing. `jest-preset-angular` handles the TypeScript + Angular template compilation. Mature, very stable, plenty of recipes for testing standalone components and signals.

Slower than Vitest, slightly different config from today's setup, but the maturity advantage matters for a foundational rewrite.

**Rejected**: Vitest. Matches current setup, fastest, but `@analogjs/vitest-angular` Angular support is still less battle-tested.

**Rejected**: Karma + Jasmine. Google deprecated Karma; not a 2026 choice.

### Build tool — Angular CLI `application` builder

Use Angular CLI's modern `application` builder (esbuild for compile, Vite for dev server). Output drops into `dist/<project>/browser/`. The home repo's `build-frontend` GitHub Actions job needs a one-line path update; nothing else in the deploy pipeline moves.

**Rejected**: standalone Vite + `@analogjs/vite-plugin-angular`. Closer to today's Vite stack but newer/less common path, more wiring for Angular features.

### PWA — `@angular/pwa`

Replace `vite-plugin-pwa` with the Angular service worker. `ng add @angular/pwa` wires the manifest and `ngsw-config.json`. The caching strategy is declarative JSON; mirror today's `NetworkFirst` strategy for `/api/*` (3s network timeout, 100-entry cache, 24h max-age) and the precache glob for `js`/`css`/`html`/`ico`/`png`/`svg`/`woff2`.

**Rejected**: keep `vite-plugin-pwa`. Only works with the Vite-only builder, which we already rejected.

**Rejected**: drop PWA in v1. Loses install/offline behaviour at cutover — small but unnecessary regression for users with the PWA installed.

### AI sidebar — in scope for v1

Port the AI sidebar feature on the cutover, not as a follow-up. `AiService`, `AiInstructionsService`, `AiContextLoader` are framework-agnostic TypeScript (Chrome on-device Prompt API + JSON parsing); they move verbatim. Only the UI components (`AiSidebar`, `AiButton`, `ChatMessage`, `ContextMeter`, `ActionPreview`, `InstructionPicker`, `UnavailableState`) get rewritten as Material components consuming AiService's signals.

**Rejected**: defer to a follow-up. Smaller initial diff but a feature regression on cutover day.

### Test coverage — critical path, not 1:1

Re-test load-bearing logic; don't mechanically port every render-shape test. Specifically: auth service + guards, wiki-link and image-size plugins, drafts service, layout service, page-editor save flow (including the "metadata-only changes also enable save" behaviour from commit `a767a80`), page tree drag-drop predicates, board state transitions, AI service action JSON parsing (incl. `ALLOW_DESTRUCTIVE=false` stripping), client search index, markdown rendering, permission guard. Skip pure JSX-shape snapshots.

**Rejected**: match React test count 1:1. Doubles the migration cost; many existing tests assert React-specific structure that doesn't survive the port in any useful sense.

**Rejected**: smoke tests only. Inadequate safety net for a 16K-LOC rewrite.

### Directory layout — `frontend-angular/` then swap

Scaffold and build the new app in `frontend-angular/` on the feature branch. React `frontend/` keeps working throughout the rewrite. Final commits delete `frontend/`, rename `frontend-angular/` → `frontend/`, update the GitHub Actions workflow's `working-directory: BluefinWiki/frontend` (no change to that path; the directory is renamed before that commit), and update Aspire AppHost wiring.

**Rejected**: replace `frontend/` in place. Cleaner history; no A/B fallback during the rewrite.

## Architecture

### Target stack

| Concern | Choice |
|---|---|
| Framework | Angular 20+, standalone components, signals-first, new control flow (`@if`/`@for`/`@switch`), `inject()` DI |
| Build | Angular CLI `application` builder (esbuild + Vite dev server) |
| UI | Angular Material 3 (only — Tailwind removed). Theming via `mat.theme()`. |
| Drag-drop | Angular CDK DragDrop |
| Data | `HttpClient` wrapped in feature services; reads exposed via `resource()` / `rxResource()` returning signals; writes as promise-returning methods |
| Auth | `amazon-cognito-identity-js` retained; wrapped in `AuthService` (signals: `isAuthenticated`, `user`, `roles`) + functional route guards + HTTP interceptor injecting bearer token |
| Markdown edit | CodeMirror 6 wrapped in a standalone `<wiki-codemirror>` component |
| Markdown render | `unified()` pipeline kept; `MarkdownRendererComponent` walks HAST tree and emits Angular templates |
| Diagrams | `mermaid` library kept; `<wiki-mermaid>` component renders on input change |
| AI | `AiService` (Chrome Prompt API) ported as-is; UI components rebuilt as Material |
| Search | `ClientSearchService` ported as-is; `SearchDialog` rebuilt as `mat-dialog` |
| Drafts / layout | Ported as signal-backed services with localStorage persistence (same keys, same JSON shape as today) |
| PWA | `@angular/pwa`; `ngsw-config.json` mirrors today's `vite-plugin-pwa` runtimeCaching |
| Tests | Jest + `jest-preset-angular`; critical-path coverage |
| Routing | Angular Router with functional guards; same URL surface as today |

### Public/private boundary

Frontend code stays public (BluefinWiki repo). Cognito config (user-pool id, client id, hosted-UI domain) flows via environment variables consumed by `environment.ts` / `environment.production.ts`. These files are generated at build time from `config.json` in the home repo (current React pattern; same approach in Angular). Nothing identifying Dean's accounts ships in source.

### Build pipeline integration

The `build-frontend` job in `home/.github/workflows/deploy-bluefinwiki.yml` keeps its shape:

```
npm ci → npm run lint → npm run test → npm run build → upload dist artifact → aws s3 sync → invalidate
```

Path updates:
- `working-directory: BluefinWiki/frontend` is unchanged after the final swap (renamed from `frontend-angular/` → `frontend/`).
- Artifact upload path changes from `BluefinWiki/frontend/dist` to `BluefinWiki/frontend/dist/<project>/browser` (Angular CLI's default output layout).
- Deploy step's `aws s3 sync frontend/dist/` becomes `aws s3 sync frontend/dist/<project>/browser/`.

No CDK changes — bucket + distribution are unchanged.

### Local dev (Aspire)

Aspire AppHost currently launches Vite on port 5173 (`AddViteApp("frontend", "../../frontend")`). After the swap it launches `ng serve --port 5173 --proxy-config proxy.conf.json`. `proxy.conf.json` routes `/api` to the backend (`http://localhost:3000`, matching today's Aspire wiring). LocalStack, MailHog, dashboard wiring is unchanged. The AppHost call updates to `AddNpmApp("frontend", "../../frontend", "start")` (or equivalent) since `AddViteApp` is Vite-specific.

## File structure

```
frontend-angular/              (renamed to frontend/ in the final swap)
├── angular.json
├── package.json
├── tsconfig.json / tsconfig.app.json / tsconfig.spec.json
├── jest.config.ts             # jest-preset-angular
├── proxy.conf.json            # dev /api → backend
├── ngsw-config.json           # PWA config
├── public/                    # favicons, manifest assets
└── src/
    ├── main.ts                # bootstrapApplication(AppComponent, appConfig)
    ├── index.html
    ├── styles.scss            # Material theme + global resets
    ├── environments/
    │   ├── environment.ts
    │   └── environment.production.ts
    └── app/
        ├── app.component.ts   # router-outlet + global chrome
        ├── app.config.ts      # provideRouter, provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])), provideAnimationsAsync, Material providers
        ├── app.routes.ts      # route table (mirrors today's <Routes>)
        │
        ├── core/                              # cross-cutting, app-wide singletons
        │   ├── auth/
        │   │   ├── auth.service.ts            # signals + sign-in/out + token storage
        │   │   ├── auth.guard.ts              # functional guard (canActivate)
        │   │   ├── admin.guard.ts             # functional guard (role === 'Admin')
        │   │   ├── auth.interceptor.ts        # attaches Bearer token, handles 401
        │   │   ├── cognito-config.ts          # builds CognitoUserPool from env
        │   │   └── cognito-oauth.ts           # PKCE helpers (port of utils/cognitoAuth.ts)
        │   ├── api/
        │   │   ├── api-client.ts              # HttpClient wrapper: base URL, error normalisation
        │   │   ├── error.interceptor.ts       # normalises 4xx/5xx → ApiError
        │   │   └── api.types.ts               # shared request/response types
        │   ├── error/
        │   │   └── global-error-handler.ts    # last-resort uncaught error handler
        │   └── layout/
        │       └── layout.service.ts          # signal-backed port of stores/layoutStore.ts
        │
        ├── shared/                            # reusable presentational/utility pieces
        │   ├── components/
        │   │   ├── confirm-dialog/
        │   │   ├── breadcrumbs/
        │   │   ├── mobile-drawer/
        │   │   ├── table-of-contents/
        │   │   ├── permission-guard.directive.ts  # *appPermission="'Admin'"
        │   │   ├── error-banner/                  # used by every resource() consumer
        │   │   └── editor-error-boundary/         # scoped fallback for the editor
        │   ├── markdown/
        │   │   ├── markdown-renderer.component.ts # HAST walker
        │   │   ├── wiki-link.component.ts
        │   │   ├── wiki-mermaid.component.ts
        │   │   ├── unified-pipeline.ts            # builds processor
        │   │   └── plugins/
        │   │       ├── remark-wiki-links.ts       # ported
        │   │       └── remark-image-size.ts       # ported
        │   ├── codemirror/
        │   │   └── wiki-codemirror.component.ts   # standalone CodeMirror 6 wrapper
        │   └── pipes/
        │       └── format-date.pipe.ts
        │
        ├── features/
        │   ├── pages/
        │   │   ├── pages-view.component.ts
        │   │   ├── page-editor.component.ts
        │   │   ├── page-tree.component.ts
        │   │   ├── page-tree-item.component.ts
        │   │   ├── page-rename-inline.component.ts
        │   │   ├── page-context-menu.component.ts        # mat-menu
        │   │   ├── new-page-modal.component.ts           # mat-dialog
        │   │   ├── create-page-from-link-modal.component.ts
        │   │   ├── linked-pages-panel.component.ts
        │   │   ├── pages.service.ts                      # CRUD, children, move, reorder, backlinks; exposes resource()s
        │   │   ├── pages.routes.ts                       # child routes for /pages/**
        │   │   └── drafts.service.ts                     # port of stores/draftsStore.ts
        │   │
        │   ├── editor/
        │   │   ├── editor-pane.component.ts              # split view, resize divider
        │   │   ├── markdown-editor.component.ts          # uses wiki-codemirror
        │   │   ├── markdown-preview.component.ts         # uses markdown-renderer
        │   │   ├── markdown-toolbar.component.ts         # mat-toolbar + mat-icon-button
        │   │   ├── link-autocomplete.component.ts        # mat-autocomplete overlay at cursor
        │   │   ├── inspector-panel.component.ts          # mat-sidenav-end / mat-bottom-sheet
        │   │   ├── page-properties-panel.component.ts
        │   │   ├── custom-properties-editor.component.ts
        │   │   ├── attachment-manager.component.ts
        │   │   ├── attachment-uploader.component.ts
        │   │   ├── attachment-upload-list.component.ts
        │   │   ├── file-upload.component.ts              # presigned-URL flow
        │   │   ├── resize-divider.component.ts           # cdkDrag with axis 'x'
        │   │   └── attachments.service.ts                # presigned upload + list/delete
        │   │
        │   ├── board/
        │   │   ├── board-view.component.ts
        │   │   ├── board-column.component.ts             # cdkDropList
        │   │   ├── board-card.component.ts               # cdkDrag
        │   │   ├── board-settings-panel.component.ts
        │   │   ├── card-summary-dialog.component.ts      # mat-dialog
        │   │   └── board.service.ts                      # state grouping, color palette
        │   │
        │   ├── search/
        │   │   ├── search-dialog.component.ts            # mat-dialog opened on Ctrl/Cmd+K
        │   │   └── client-search.service.ts              # port of services/ClientSearchService.ts
        │   │
        │   ├── ai/
        │   │   ├── ai-sidebar.component.ts
        │   │   ├── ai-button.component.ts
        │   │   ├── chat-message.component.ts
        │   │   ├── context-meter.component.ts
        │   │   ├── action-preview.component.ts
        │   │   ├── instruction-picker.component.ts       # mat-select
        │   │   ├── unavailable-state.component.ts
        │   │   ├── ai.service.ts                         # port of services/AiService.ts
        │   │   ├── ai-context-loader.ts                  # port of services/AiContextLoader.ts
        │   │   └── ai-instructions.service.ts            # port of services/AiInstructionsService.ts
        │   │
        │   ├── page-types/                               # admin: page-type schema editor
        │   │   ├── page-types-admin.component.ts
        │   │   └── page-types.service.ts
        │   │
        │   ├── admin/
        │   │   ├── settings-page.component.ts
        │   │   ├── user-management.component.ts
        │   │   ├── invitation-management.component.ts
        │   │   ├── rebuild-page-index.component.ts
        │   │   ├── profile-page.component.ts
        │   │   ├── users.service.ts
        │   │   ├── invitations.service.ts
        │   │   └── admin-tasks.service.ts
        │   │
        │   ├── callback/
        │   │   └── oauth-callback.component.ts           # /callback route
        │   │
        │   └── not-found/
        │       └── not-found.component.ts                # 404 fallback
        │
        └── types/                                        # ports of src/types/
            └── *.ts
```

### Layout rationale

- **One folder per feature**, each owning its components and its service. A developer can read a feature without crossing the repo.
- **`core/`** holds things every feature uses: auth, http, error handling, layout prefs.
- **`shared/`** holds reusable presentational pieces *and* the markdown/codemirror infrastructure — they're not tied to any single feature.
- Folder names match feature areas in today's `src/components/` so the React → Angular mapping is visible at a glance.
- Standalone components throughout — no NgModules.

### Routing

```ts
// app.routes.ts
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'pages' },
  { path: 'callback', loadComponent: () => import('./features/callback/oauth-callback.component').then(m => m.OAuthCallbackComponent) },

  { path: 'pages', canActivate: [authGuard], loadChildren: () => import('./features/pages/pages.routes').then(m => m.PAGES_ROUTES) },
  { path: 'profile', canActivate: [authGuard], loadComponent: () => import('./features/admin/profile-page.component').then(m => m.ProfilePageComponent) },

  { path: 'settings',          canActivate: [authGuard, adminGuard], loadComponent: () => import('./features/admin/settings-page.component').then(m => m.SettingsPageComponent) },
  { path: 'admin/page-types',  canActivate: [authGuard, adminGuard], loadComponent: () => import('./features/page-types/page-types-admin.component').then(m => m.PageTypesAdminComponent) },
  { path: 'admin/users',       canActivate: [authGuard, adminGuard], loadComponent: () => import('./features/admin/user-management.component').then(m => m.UserManagementComponent) },
  { path: 'admin/invitations', canActivate: [authGuard, adminGuard], loadComponent: () => import('./features/admin/invitation-management.component').then(m => m.InvitationManagementComponent) },
  { path: 'admin/rebuild-page-index', canActivate: [authGuard, adminGuard], loadComponent: () => import('./features/admin/rebuild-page-index.component').then(m => m.RebuildPageIndexComponent) },

  { path: '**', loadComponent: () => import('./features/not-found/not-found.component').then(m => m.NotFoundComponent) },
];
```

`features/pages/pages.routes.ts` defines `pages/:guid` and `pages/:guid/edit` children — explicit Angular routes replace today's React `pages/*` catch-all.

## Data flow

### Reads (server → UI)

Feature services expose `rxResource`-backed readers. Requests are functions of signals; loaders rerun when those signals change.

```ts
// features/pages/pages.service.ts
@Injectable({ providedIn: 'root' })
export class PagesService {
  private http = inject(HttpClient);

  childrenResource(parentGuid: () => string | null) {
    return rxResource({
      request: () => ({ parentGuid: parentGuid() }),
      loader: ({ request }) =>
        this.http.get<PageChildrenResponse>('/api/pages/children', {
          params: request.parentGuid ? { parent: request.parentGuid } : {},
        }),
    });
  }

  pageContent(guid: () => string) {
    return rxResource({
      request: () => ({ guid: guid() }),
      loader: ({ request }) => this.http.get<PageContent>(`/api/pages/${request.guid}`),
    });
  }

  backlinks(guid: () => string) {
    return rxResource({
      request: () => ({ guid: guid() }),
      loader: ({ request }) => this.http.get<BacklinksResponse>(`/api/pages/${request.guid}/backlinks`),
    });
  }
}
```

Component usage:

```ts
@Component({
  selector: 'wiki-page-editor',
  template: `
    @if (page.isLoading()) { <mat-spinner /> }
    @else if (page.error()) { <wiki-error-banner [message]="page.error()?.message" (retry)="page.reload()" /> }
    @else if (page.value(); as content) {
      <wiki-markdown-editor [value]="content.markdown" (valueChange)="onChange($event)" />
    }
  `,
})
export class PageEditorComponent {
  private pages = inject(PagesService);
  guid = input.required<string>();
  page = this.pages.pageContent(this.guid);
}
```

**No client-side cache** — matches today's TanStack Query config (`staleTime: 0`, `gcTime: 0`).

### Writes (UI → server)

Mutations are promise-returning service methods. Components await them and call `resource.reload()` to refetch dependent data.

```ts
// inside PagesService
async updatePage(guid: string, body: UpdatePageRequest): Promise<PageContent> {
  return firstValueFrom(this.http.put<PageContent>(`/api/pages/${guid}`, body));
}

async movePage(req: MovePageRequest): Promise<void> {
  await firstValueFrom(this.http.post<void>('/api/pages/move', req));
}
```

```ts
async save() {
  await this.pages.updatePage(this.guid(), { markdown: this.draft.content, metadata: this.draft.metadata });
  this.page.reload();
  this.drafts.clear(this.guid());
}
```

### Auth flow

1. `AuthService` reads the stored `idToken` from `localStorage` on app start, validates expiry, seeds its `isAuthenticated` / `user` / `roles` signals.
2. `authGuard` (functional) returns `true` if `isAuthenticated()`. Otherwise calls `cognitoOauth.redirectToLogin()` (PKCE: stores code-verifier in `sessionStorage`, redirects to Cognito Hosted UI) and returns `false`.
3. `/callback` renders `OAuthCallbackComponent`, which calls `cognitoOauth.handleOAuthCallback(code, state)`, stores tokens, sets the `CognitoUser` session, then `router.navigate(['/pages'])`.
4. `authInterceptor` attaches `Authorization: Bearer ${idToken}` to every `/api/**` request. On 401 it triggers `redirectToLogin()` (token expired mid-session) and returns `EMPTY`.
5. `adminGuard` returns `roles().includes('Admin')`. Used with `authGuard` on `/admin/**` and `/settings`.

Role parsing matches today: read `cognito:groups` (or whatever claim today's code uses) off the decoded ID token, normalise to `Admin` / `Standard`.

### Local state — drafts

`DraftsService` ports `stores/draftsStore.ts` verbatim. Same `bluefinwiki:draft:` localStorage prefix, same memory cache fronting it. Existing drafts in users' browsers keep working unchanged after the cutover.

```ts
@Injectable({ providedIn: 'root' })
export class DraftsService {
  private memory = new Map<string, PageDraft>();
  get(guid: string): PageDraft | undefined { /* memory then localStorage */ }
  set(guid: string, draft: PageDraft): void { /* memory + localStorage */ }
  clear(guid: string): void { /* both */ }
  hasDraft(guid: string): boolean { /* … */ }
}
```

### Local state — layout preferences

`LayoutService` ports `stores/layoutStore.ts`. Same `bluefinwiki-layout` localStorage key, same `LayoutPreferences` shape. Exposed as a writable signal with an `effect()` that persists on change. Existing user preferences survive the cutover.

### Wiki-link autocomplete

`PagesService.searchPages(query)` returns `Observable<PageSearchResult[]>`. The CodeMirror wrapper observes cursor + recent characters; when it detects `[[…]` context it pushes a query into a signal. The autocomplete dropdown (a Material overlay positioned at the cursor) renders results from the search resource. Same UX as today.

### Search index

`ClientSearchService` keeps the same logic: subscribe to a page-index-refresh signal, fetch the lightweight summary endpoint, build the in-memory index, debounced query API. `SearchDialog` (a `mat-dialog` triggered by Ctrl/Cmd+K) consumes it. Filtering controls (scope, title-only, recent history) port across.

### AI sidebar

`AiService` is pure framework-agnostic logic over Chrome's Prompt API — it ports byte-for-byte. The Angular components consume:

- `messages` signal (chat history)
- `inputUsage` / `inputQuota` signal pair (context meter)
- `streaming` signal
- `currentAction` signal (preview of pending action)

`AiInstructionsService` and `AiContextLoader` port as-is.

### Drag-drop semantics

- **Page tree**: each `<wiki-page-tree-item>` is a `cdkDrag` inside a `cdkDropList`. `cdkDropListEnterPredicate` enforces page-type hierarchy rules (port of today's drag-validation code). On drop, call `PagesService.movePage()` or `reorderPage()` and reload the children resource.
- **Board**: each column is a `cdkDropList`, each card a `cdkDrag`. Drop emits a new state assignment; service calls `PagesService.updatePage()` to set the `state` property; the column resource reloads. `cdkDropListConnectedTo` links columns so cards drag between them.
- **Editor resize divider**: `cdkDrag` with `cdkDragLockAxis="x"`; emits new split position, persisted via `LayoutService`.

### Cross-component communication

- Parent → child: `input()` signals; `model()` for two-way binding (editor value).
- Child → parent: `output()` events.
- Cross-route shared state (e.g. "page tree should refresh because downstream code created a page"): the relevant service exposes a `bumpVersion()` method that increments a signal which `rxResource` requests depend on. No global store, no event bus.

## Error handling

| Layer | Catches | Action |
|---|---|---|
| `authInterceptor` | 401 from `/api/**` | `cognitoOauth.redirectToLogin()`, return `EMPTY` |
| `errorInterceptor` | Other 4xx/5xx from `/api/**` | Normalise to `ApiError { status, code, message, requestId }` parsed from the backend envelope; rethrow |
| Feature services | Normalised `ApiError` | Domain-specific recovery if any; otherwise propagate |
| Component | Errors from `rxResource` or awaited mutations | Inline `<wiki-error-banner>` in the affected panel — 95% of cases |
| `GlobalErrorHandler` | Any uncaught exception (template, lifecycle, listener) | Console-log with stack + zone state; show `mat-snack-bar` with retry-reload affordance. Last-resort safety net. |

### Render errors (the React `EditorErrorBoundary`)

Angular has no render-error boundary equivalent. We get the same effect via:

1. A custom `ErrorHandler` registered globally catches synchronous throws in templates and lifecycle hooks.
2. `EditorPaneComponent` owns a `hasFatalError` signal. The custom error handler, when it detects an error originating from inside the editor subtree (offending instance tagged via a context token), flips the signal. The template renders a "The editor crashed — retry" panel in place of the editor.
3. The retry button clears the signal and forces re-render via a separate `version` signal.

Everywhere else, an unhandled render error becomes the global snack-bar.

### Auth state errors

- Stored token decodes but is expired on app start → clear tokens, route to `/`, guard kicks off the redirect.
- Stored token present but `/api/me` returns 401 → interceptor handles.
- `/callback` invoked without `code` / `state` → render the existing "Sign in failed" panel with "Try again" (port of today's `OAuthCallbackPage` error UI).
- PKCE state mismatch (CSRF) → same panel, distinct message.

### Network / offline

- The Angular service worker handles transient offline via `NetworkFirst` for `/api/*` (3s timeout).
- Write fails because of offline → snack-bar "You appear to be offline — your changes are saved as a draft". `DraftsService` already persists, so the user doesn't lose work (matches today's behaviour).

### Validation errors

Today's inline field-level errors port to Angular Reactive Forms with Material's `<mat-form-field>` error styling. Each form component owns its validators. The page-type schema (with required properties + types) is converted to a `FormGroup` per page edit.

### Drag-drop validation

When `cdkDropListEnterPredicate` rejects a drop (page-type hierarchy rule violation), CDK prevents the drop. We add a transient hint: when the predicate returns `false`, the dragged item gets a `data-drop-invalid` attribute (set in `cdkDragMoved`) and a tooltip explains "Cannot drop a TVShow under a Recipe". Matches today's "invalid moves are blocked with a warning" behaviour.

### Logging

No external log shipper. `console.error` for everything (matches today). The AI sidebar already has structured debug logging via `aiDebug` — port that utility as-is.

## Testing

### Stack

- **Runner**: Jest with `jest-preset-angular` (TypeScript ESM via `ts-jest`).
- **Component testing**: `TestBed` + `ComponentFixture`; `@testing-library/angular` for DOM-centric, role-based queries (same mental model as today's React tests).
- **HTTP**: `HttpTestingController` for URL/method/header/body assertions and canned responses.
- **DOM env**: `jsdom` (jest-preset-angular default).

### Tests to port or add

| Area | Tests | Origin |
|---|---|---|
| Auth | sign-in redirect, callback success, callback failure (missing code/state, PKCE mismatch), token expiry triggers redirect, `authGuard` blocks unauthenticated, `adminGuard` blocks non-admin | port `contexts/AuthContext.test.tsx` + new |
| Wiki-link plugin | `[[Title]]` → link, `[[Title\|alias]]` → link with alias, missing page → broken-link marker, escape sequences, code-block exclusion | new — derive behaviours from `utils/__tests__/wikiLinkParser.test.ts` and `components/editor/__tests__/MarkdownPreview.wikiLinks.test.tsx`; write a focused test of `plugins/remark-wiki-links.ts` against the unified pipeline |
| Image-size plugin | width-only, height-only, both, ignored without attrs | new — no existing test; write against the ported `plugins/remark-image-size.ts` |
| DraftsService | get/set/clear round-trip, memory cache hit, localStorage round-trip, malformed JSON survives, key-collision safety | port `__tests__` of `draftsStore` |
| LayoutService | defaults on first load, persistence round-trip, signal-driven persistence fires once per change | new (small) |
| PageEditor save | save success → `updatePage` + reload + clear draft; save failure → error banner + preserve draft; save-disabled when no changes (incl. metadata-only changes per commit `a767a80`); Ctrl+S triggers save | port `PageEditor.test.tsx` |
| Page tree drag-drop predicates | allowed types accept drop, disallowed types reject, root-only types reject when nested, depth limits respected if any | port + new |
| Board state transitions | drop between columns → `updatePage` with new state; drop within → reorder; "Uncategorised" collects unset state; custom column order respected | port |
| AI service | action JSON parsing (create/update/move/delete), destructive actions stripped when `ALLOW_DESTRUCTIVE=false`, schema fields enforced, context-window usage signal updates | port `services/__tests__` |
| Client search | index built from page summaries, debounced query, scope filter, title-only mode, recent history cap | port `services/__tests__` |
| Markdown rendering | unified pipeline produces expected HAST, custom plugins applied in order, mermaid block routed to `<wiki-mermaid>`, code blocks get syntax-highlight class | port + new |
| PermissionGuard directive | renders children when role matches, hides when not | port `common/__tests__` |

### Not ported

- React render-shape snapshots asserting purely presentational copy. They re-pass mechanically and provide little safety.
- Tests asserting JSX-specific structure (`expect(container.firstChild).toHaveClass(...)`) — Angular's class application differs and asserting it adds noise without catching regressions.

### Test layout

Co-located: `feature-name.component.spec.ts` next to `feature-name.component.ts`; service tests next to services; plugin tests under `shared/markdown/plugins/__tests__/`. Matches today's co-location style.

### Mocking strategy

- **HTTP**: `HttpTestingController`. No MSW.
- **Cognito**: stub `CognitoUserPool` / `CognitoUser` at the `AuthService` boundary.
- **CodeMirror**: mock `EditorView` for wrapper-input/output tests; only `wiki-codemirror.component.spec.ts` exercises real CodeMirror against jsdom.
- **Mermaid**: stub `mermaid.render`; verify wrapper invokes it with correct input and renders returned SVG.
- **Chrome Prompt API**: define a mock `LanguageModel` global before each AI test (matches today's Vitest setup).

### Coverage budget

No percentage threshold initially. After the port lands, run coverage once, eyeball gaps in critical-path files, add targeted tests. Threshold gates can come later.

### CI integration

`npm test` in `frontend/` (after the rename) runs Jest. Job position in `home/.github/workflows/deploy-bluefinwiki.yml` is unchanged. Jest produces JUnit XML via `jest-junit` for the GitHub Actions test summary — a small upgrade; today's Vitest run doesn't surface a summary.

## Success criteria

- Angular app at the same URL surface as today: `/`, `/pages`, `/pages/:guid`, `/pages/:guid/edit`, `/profile`, `/settings`, `/admin/page-types`, `/admin/users`, `/admin/invitations`, `/admin/rebuild-page-index`, `/callback`.
- Auth flow against the real Cognito Hosted UI works for sign-in, callback, role-restricted routes, and silent token-expiry redirect.
- Every feature listed in the BluefinWiki README's "Features" section works on day one of the cutover.
- Existing user drafts and layout preferences survive the cutover (same localStorage keys, same JSON shape).
- `home/.github/workflows/deploy-bluefinwiki.yml` builds and deploys the Angular app to S3 with at most a workflow path edit (no logic changes).
- No CDK changes required.
- All ported tests pass under Jest.
- App boots in dev under Aspire on the same port the Vite dev server used (5173).

## Out of scope

- Switching backend Lambda runtime, refactoring API contracts, adding new endpoints.
- Schema or data-shape changes (pages, page types, attachments, users, invitations).
- New features.
- Visual redesign beyond what Material requires.
- Migrating Chess or any other BlueFin605 project as part of this work.
