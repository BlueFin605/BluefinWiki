# React → Angular Conversion — Phase 6: Admin

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-05-21-bluefinwiki-react-to-angular-design.md`
**Roadmap:** `docs/superpowers/plans/2026-05-21-bluefinwiki-react-to-angular-roadmap.md`
**Branch:** `feat/angular-rewrite` (continues from local tag `phase-5-board`, commit `455246f`).
**Working directory:** `BluefinWiki/frontend-angular/`.

**Goal:** Ship the admin feature set — page-types schema editor, settings landing page, user management, invitation management, page-index rebuild trigger, and the user-facing profile page. All gated behind `authGuard + adminGuard` (per Phase 1), except `/profile` which is auth-only. Replace the Phase 1 placeholder routes with real components.

**Architecture:**
- **PageTypes mutations:** Extend the existing `PageTypes` service (Phase 4 read-only) with `createPageType`, `updatePageType`, `deletePageType`, plus `allowedChildTypesResource` is already present. The admin UI uses both the resource readers and the new mutations.
- **New services:** `Users` (admin), `Invitations` (admin), `AdminTasks` (rebuild page index). Each `@Injectable({ providedIn: 'root' })`, signal/rxResource shape matching Phases 3–5.
- **Profile:** Lives in `features/profile/` (the spec puts it under `admin/` but it's auth-only and conceptually distinct from admin tasks). Reads from `Auth` service; for now exposes user info + sign-out. Future password-change UI is out of scope.
- **Forms:** Material reactive forms throughout. `<mat-form-field>` with validators.

**Cross-phase reminders:** Local-only execution. Angular 21 zoneless testing patterns from `feedback_angular_21_zoneless_testing` (now 12+ entries — read them).

---

## Task 1: `PageTypes` service mutations

**Files:**
- Modify: `BluefinWiki/frontend-angular/src/app/features/page-types/page-types.ts`
- Modify: `BluefinWiki/frontend-angular/src/app/features/page-types/page-types.spec.ts`

Add three promise-returning mutations matching React's `usePageTypes.ts`:

```ts
export interface CreatePageTypeRequest {
  name: string;
  icon: string;
  properties?: PageTypeProperty[];
  allowedChildTypes?: string[];
  allowWikiPageChildren?: boolean;
  allowedParentTypes?: string[];
  allowAnyParent?: boolean;
}

export interface UpdatePageTypeRequest extends Partial<CreatePageTypeRequest> {}

async createPageType(body: CreatePageTypeRequest): Promise<PageTypeDefinition> {
  const result = await firstValueFrom(this.http.post<PageTypeDefinition>('/api/page-types', body));
  this.bumpVersion();
  return result;
}

async updatePageType(guid: string, body: UpdatePageTypeRequest): Promise<PageTypeDefinition> {
  const result = await firstValueFrom(this.http.put<PageTypeDefinition>(`/api/page-types/${guid}`, body));
  this.bumpVersion();
  return result;
}

async deletePageType(guid: string): Promise<void> {
  await firstValueFrom(this.http.delete<void>(`/api/page-types/${guid}`));
  this.bumpVersion();
}
```

Tests (~4): each mutation hits the right URL/method/body and bumps version triggering resource refetch (apply the Phase 5 lesson about `settle()` before `expectOne`).

- [ ] Spec + implement + `git commit -m "feat(angular): PageTypes service mutations for admin"`

---

## Task 2: `<wiki-page-types-admin>`

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/page-types/page-types-admin.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/page-types/page-types-admin.spec.ts`
- Modify: `BluefinWiki/frontend-angular/src/app/app.routes.ts` — replace placeholder with this
- Delete: `BluefinWiki/frontend-angular/src/app/features/placeholder/page-types-placeholder.ts`

A two-pane layout: left list of page types from `pageTypesResource()`, right side editor for the selected one. Editor form fields:
- Name (text, required, 1–50 chars)
- Icon (text — accepts emoji or short string)
- Properties (schema builder — add/remove rows with name + type select + required toggle + default value)
- Allowed child types (multi-select from existing page types)
- Allow wiki-page children (toggle)
- Allowed parent types (multi-select)
- Allow any parent (toggle)

Plus a "New page type" button (top-right) and per-row delete buttons.

Save calls `createPageType` (new) or `updatePageType` (existing). Delete calls `deletePageType` with a `mat-dialog` confirmation.

Property name normalisation: `name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')` matches React's kebab-case rule. Reject if collision with existing property name.

Tests (~6):
- Lists existing page types
- Selecting one populates the form
- "New" clears the form
- Save (new) sends POST
- Save (existing) sends PUT
- Delete prompts a confirm dialog and on confirm sends DELETE

- [ ] Spec + implement + wire route + delete placeholder + `git commit -m "feat(angular): PageTypesAdmin with schema builder + CRUD"`

---

## Task 3: `Users` (admin) service

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/admin/users.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/admin/users.spec.ts`

```ts
export interface UserRecord {
  userId: string;
  email: string;
  displayName: string;
  role: 'Admin' | 'Standard';
  status: string;
  createdAt: string;
  lastLoginAt?: string;
  cognitoEnabled?: boolean;
}

export interface UpdateUserRequest {
  role?: 'Admin' | 'Standard';
  displayName?: string;
}

@Injectable({ providedIn: 'root' })
export class Users {
  // usersResource() → GET /api/admin/users
  // updateUser(userId, body) → PUT /api/admin/users/:id
  // suspendUser(userId) → POST /api/admin/users/:id/suspend
  // activateUser(userId) → POST /api/admin/users/:id/activate
  // deleteUser(userId) → DELETE /api/admin/users/:id
  // bumpVersion()
}
```

Tests (~5): each endpoint with right method/URL, resource refetches after mutation.

- [ ] Spec + implement + `git commit -m "feat(angular): admin Users service"`

---

## Task 4: `<wiki-user-management>`

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/admin/user-management.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/admin/user-management.spec.ts`
- Modify: `app.routes.ts` — replace `/admin/users` placeholder
- Delete: `features/placeholder/users-placeholder.ts`

Material `<mat-table>` listing users with columns: displayName, email, role, status, lastLoginAt, actions. Search box filters client-side.

Edit row → opens a `mat-dialog` with a small form (role select + displayName text). Save → `users.updateUser(userId, form)`.

Suspend/Activate buttons → call `users.suspendUser` / `users.activateUser`. Delete → confirm dialog → `users.deleteUser`.

Tests (~4): renders rows, search filters, edit dialog calls updateUser with right body, delete prompts confirm and calls deleteUser.

- [ ] Spec + implement + wire route + delete placeholder + `git commit -m "feat(angular): UserManagement page"`

---

## Task 5: `Invitations` service + `<wiki-invitation-management>`

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/admin/invitations.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/admin/invitations.spec.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/admin/invitation-management.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/admin/invitation-management.spec.ts`
- Modify: `app.routes.ts`
- Delete: `features/placeholder/invitations-placeholder.ts`

Service: `invitationsResource()` (GET /api/admin/invitations) + `createInvitation({ email, role })` (POST /api/admin/invitations).

Component: list with email + status + createdAt; create button opens dialog with email + role form.

Tests (~5 across service + component).

- [ ] Spec + implement + wire route + `git commit -m "feat(angular): Invitations service + InvitationManagement page"`

---

## Task 6: `AdminTasks` service + `<wiki-rebuild-page-index>`

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/admin/admin-tasks.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/admin/admin-tasks.spec.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/admin/rebuild-page-index.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/admin/rebuild-page-index.spec.ts`
- Modify: `app.routes.ts`
- Delete: `features/placeholder/rebuild-index-placeholder.ts`

Service: `async rebuildPageIndex(): Promise<RebuildResult>` — POSTs `/api/admin/rebuild-page-index`. Result shape: `{ pagesProcessed: number, errors: string[] }`.

Component: simple page with one button + last-result display. Show loading spinner while in-flight. On success, display the result + success snackbar.

Tests (~3): button calls rebuildPageIndex, success result displays, error shows snackbar.

- [ ] Spec + implement + wire route + `git commit -m "feat(angular): AdminTasks service + RebuildPageIndex page"`

---

## Task 7: `<wiki-settings-page>` (landing)

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/admin/settings-page.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/admin/settings-page.spec.ts`
- Modify: `app.routes.ts`
- Delete: `features/placeholder/settings-placeholder.ts`

A landing page at `/settings` showing tiles linking to:
- Page types (`/admin/page-types`)
- User management (`/admin/users`)
- Invitations (`/admin/invitations`)
- Rebuild page index (`/admin/rebuild-page-index`)
- Profile (`/profile`) — visible to all auth'd users, others admin-only

Simple `<mat-card>` grid. Each card has icon + title + short description.

Tests (~3): renders all admin tiles for admin, hides admin-only tiles for non-admin (use mocked `Auth` service with role: 'Standard'), each tile is a routerLink to the expected URL.

- [ ] Spec + implement + wire route + `git commit -m "feat(angular): SettingsPage landing tiles"`

---

## Task 8: `<wiki-profile-page>`

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/profile/profile-page.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/profile/profile-page.spec.ts`
- Modify: `app.routes.ts`
- Delete: `features/placeholder/profile-placeholder.ts`

Reads `Auth.user()` (signal). Renders:
- Display name + email + role
- "Sign out" button → `auth.signOut(); router.navigate(['/'])`
- (Phase 6 deliberately skips password-change — Cognito Hosted UI handles it externally)

Tests (~3): renders user info, sign out button calls auth.signOut and navigates, shows "not signed in" when user is null.

- [ ] Spec + implement + wire route + `git commit -m "feat(angular): ProfilePage with sign-out"`

---

## Task 9: Header/sidebar links to Settings + Profile

**Files:**
- Modify: `BluefinWiki/frontend-angular/src/app/features/pages/pages-view.ts`
- Modify: `BluefinWiki/frontend-angular/src/app/features/pages/pages-view.spec.ts`

Add a `mat-icon-button` with `mat-menu` to the top toolbar (right side, after the New Page button). Menu items:
- "Settings" → `/settings` (admin only — gated by `Auth.user()?.role === 'Admin'`)
- "Profile" → `/profile`
- "Sign out" → `auth.signOut() && router.navigate(['/'])`

Tests (~2): menu opens, admin sees Settings entry, standard user does not.

- [ ] Spec + implement + `git commit -m "feat(angular): user menu in PagesView header"`

---

## Task 10: Local smoke + Phase 6 exit gate

**Files:** no source changes.

- [ ] **Step 1: Local gate**
  ```bash
  cd BluefinWiki/frontend-angular
  npm run lint && npm test && npm run build && npm run build:prod
  ```
  Expected: all green.

- [ ] **Step 2: Verify no orphan placeholders**
  ```bash
  ls src/app/features/placeholder/
  ```
  Should only contain ones we still need (none of: page-types, users, invitations, rebuild-index, settings, profile). If any of those still exist, delete them and re-run the gate.

- [ ] **Step 3: Tag (local-only)**
  ```bash
  git -C BluefinWiki tag phase-6-admin
  ```
  Do NOT push.

---

## What's next

Phase 7: **Search + AI**. `ClientSearchService` ports from React (build in-memory index from `/api/pages/summaries`), `SearchDialog` is a `mat-dialog` triggered by Ctrl/Cmd+K, AI sidebar uses Chrome Prompt API (`AiService`, `AiInstructionsService`, `AiContextLoader` port verbatim; UI rebuilt as Material).
