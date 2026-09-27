# Phase 8 Admin/Profile E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** automate the 5 manual-walkthrough exit-criteria items still owed
for Phase 8 (admin back-nav, profile display-name + change-password,
Members Edit-disabled/Retry, Invitations pills/code/validation, rebuild-index
confirm gate) as Playwright specs in `e2e/`, closing the last "manual
browser walkthrough owed" line for this phase in
`docs/flows/angular-parity-plan/README.md`.

**Architecture:** these are validation tests against already-shipped,
already-task-reviewed production code (Phase 8 is code-complete, `fe4b1f9`)
— not TDD driving new production code. Each task writes a spec file, runs it
against the local dev stack, and treats a genuine failure as a real finding
to report (not a step to silently work around). The one exception is Task 3
(Change Password), which deliberately asserts request *shape* rather than a
real success response — see that task for why.

**Tech Stack:** Playwright (`e2e/` package, already scaffolded), the local
Aspire-orchestrated dev stack (`dotnet run --project aspire/BlueFinWiki.AppHost`
— backend on :3000, frontend `ng serve` on :5173, LocalStack on :4566).

## Global Constraints

- Work happens **in place** on branch `feat/angular-rewrite` (NOT master, NO
  worktree) — matches every prior phase in this repo.
- `npm test` (jsdom) and `npm run lint` in `frontend/` must stay green — this
  plan adds no frontend production code, so they should be unaffected, but
  confirm at the end anyway.
- New/changed e2e files must pass `npx tsc --noEmit` in `e2e/` (no enforced
  script yet per Phase 1b's N7 finding, but the whole-branch reviewer for
  this plan should still run it manually).
- Every commit's message must carry a `Plan:` trailer pointing at this file
  (2026-09-08 standing instruction for this repo's angular-rewrite work).
- Playwright worker count stays capped (`e2e/playwright.config.ts`'s
  `workers: 3` / `PW_WORKERS`) — do not raise it as part of this plan.
- The local dev stack's auth is **already fully authenticated as Admin** on
  every `page.goto()` — `disableAuth: true` (`frontend/src/environments/environment.ts:13`)
  sets `localStorage['idToken']`/`['accessToken']` to `'mock-jwt-token'` and a
  hardcoded `MOCK_ADMIN` (`role: 'Admin'`) user on every bootstrap, and the
  backend's `auth.ts:87-96` special-cases that exact token. **No login flow,
  no `storageState`, no Cognito Hosted-UI automation is needed or possible
  here** — every task below just navigates straight to its target route.

---

## File Structure

- Create: `e2e/tests/admin-back-nav.spec.ts` — item 1
- Create: `e2e/tests/profile-forms.spec.ts` — item 2
- Create: `e2e/fixtures/admin-users.ts` — DynamoDB user-seeding helper, needed by item 3
- Create: `e2e/tests/members-admin.spec.ts` — item 3
- Create: `e2e/tests/invitations-admin.spec.ts` — item 4
- Create: `e2e/tests/rebuild-index-confirm.spec.ts` — item 5
- Modify: `e2e/tests/helpers.ts` — add a generic `routeFailure()` helper (used by items 3's Retry case)
- Modify: `docs/flows/angular-parity-plan/phase-8-admin-profile/README.md` — tick exit criteria
- Modify: `docs/flows/angular-parity-plan/README.md` — status board row (final task only)

---

### Task 1: `routeFailure()` helper + `admin-back-nav.spec.ts` (item 1)

**Files:**
- Modify: `e2e/tests/helpers.ts`
- Create: `e2e/tests/admin-back-nav.spec.ts`

**Interfaces:**
- Produces: `routeFailure(page: Page, urlPattern: string | RegExp, status: number, body?: unknown): Promise<void>` — registers a one-shot-ish `page.route()` that fulfills matching requests with the given status/JSON body. Later tasks (Task 4's Retry case) consume this exact signature.

- [ ] **Step 1: Add `routeFailure` to `e2e/tests/helpers.ts`**

```ts
export async function routeFailure(
  page: Page,
  urlPattern: string | RegExp,
  status: number,
  body: unknown = { message: 'Simulated failure' },
): Promise<void> {
  await page.route(urlPattern, (route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }),
  );
}
```

- [ ] **Step 2: Write `e2e/tests/admin-back-nav.spec.ts`**

All six admin/settings/profile screens render the same `wiki-admin-back-header`
component (`aria-label="Back to pages"`, real `router.navigate(['/pages'])`
on click — `admin-back-header.ts:21`). One parametrized test covers all six.

```ts
import { test, expect } from '@playwright/test';

const ROUTES = ['/settings', '/admin/users', '/admin/invitations', '/admin/page-types', '/admin/rebuild-page-index', '/profile'];

test.describe('Admin/profile back navigation', () => {
  for (const route of ROUTES) {
    test(`"${route}" has a working back-to-pages affordance`, async ({ page }) => {
      await page.goto(route);
      const back = page.getByRole('button', { name: 'Back to pages' });
      await expect(back).toBeVisible();
      await back.click();
      await expect(page).toHaveURL(/\/pages$/);
    });
  }
});
```

- [ ] **Step 3: Run it**

Run: `cd e2e && npx playwright test admin-back-nav.spec.ts`
Expected: 6/6 pass. (No fixture data needed — these routes render with an
empty/default admin state.)

- [ ] **Step 4: Commit**

```bash
git add e2e/tests/helpers.ts e2e/tests/admin-back-nav.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add admin/profile back-navigation coverage (Phase 8 item 1)

Plan: docs/superpowers/plans/2026-09-20-phase-8-admin-profile-e2e.md
EOF
)"
```

---

### Task 2: `profile-forms.spec.ts` — display name (item 2, real success path)

**Files:**
- Create: `e2e/tests/profile-forms.spec.ts`

**Interfaces:**
- Consumes: nothing new — plain `@playwright/test` `page.goto('/profile')`.

- [ ] **Step 1: Write the display-name half of the spec**

`ProfilePage` (`frontend/src/app/features/profile/profile-page.ts`): input
labeled "Display Name", Save button disabled until the trimmed value
differs from current, `PUT /api/auth/profile {displayName}` on submit,
success toast `'Profile updated.'`.

```ts
import { test, expect } from '@playwright/test';

test.describe('Profile page', () => {
  test('display name can be changed and persists', async ({ page }) => {
    await page.goto('/profile');
    const input = page.getByLabel('Display Name');
    const newName = `E2E Admin ${Date.now()}`;
    await input.fill(newName);

    const save = page.getByRole('button', { name: 'Save', exact: true });
    await expect(save).toBeEnabled();
    await save.click();

    await expect(page.getByText('Profile updated.')).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('Display Name')).toHaveValue(newName);
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd e2e && npx playwright test profile-forms.spec.ts`
Expected: 1/1 pass.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/profile-forms.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): cover Profile display-name save+persist (Phase 8 item 2, part 1)

Plan: docs/superpowers/plans/2026-09-20-phase-8-admin-profile-e2e.md
EOF
)"
```

---

### Task 3: Change Password request-shape regression test (item 2, part 2)

**Files:**
- Modify: `e2e/tests/profile-forms.spec.ts`

**Why this test asserts request shape, not a real success toast:**
`auth-change-password.ts` calls Cognito's real `ChangePasswordCommand` with
no `endpoint` override, so it resolves against whatever `AWS_ENDPOINT_URL`
is set to — Aspire sets that to LocalStack (`Program.cs:33`), and
LocalStack's `SERVICES=s3,dynamodb,ses` does **not** include Cognito. The
call always fails server-side against this local stack (falls through to a
generic 500), regardless of whether the request is correct. A prior
whole-branch review already found and fixed a real bug here — the endpoint
was sending the **ID token** instead of the **access token** via a new
`X-Access-Token` header, so Cognito always rejected a correct password
(`docs/flows/angular-parity-plan/README.md`'s Phase 8 status-board row, fix
`fe4b1f9`). The regression this test protects against is specifically "does
the header come back", verified by intercepting the outgoing request — a
real 200 isn't achievable against this stack, so don't chase one.

- [ ] **Step 1: Add the interception-based regression test**

```ts
test('change-password sends the access token via X-Access-Token (regression: fe4b1f9)', async ({ page }) => {
  await page.goto('/profile');

  let capturedHeader: string | undefined;
  await page.route('**/api/auth/change-password', async (route) => {
    capturedHeader = route.request().headers()['x-access-token'];
    // Can't get a real 200 locally (see plan comment) — fulfill success so
    // the UI's own success path is still exercised end-to-end.
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.getByLabel('Current Password').fill('CurrentPass123!');
  await page.getByLabel('New Password').fill('NewPass456!');
  await page.getByLabel('Confirm Password').fill('NewPass456!');

  const submit = page.getByRole('button', { name: 'Change Password' });
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page.getByText('Password changed.')).toBeVisible();
  expect(capturedHeader, 'X-Access-Token header must be present and non-empty').toBeTruthy();

  // Fields clear on success.
  await expect(page.getByLabel('Current Password')).toHaveValue('');
});
```

- [ ] **Step 2: Run it**

Run: `cd e2e && npx playwright test profile-forms.spec.ts`
Expected: 2/2 pass.

- [ ] **Step 3: Verify it would have caught the original bug**

Temporarily edit `frontend/src/app/core/auth/auth.ts`'s `changePassword()`
to send the ID token under `X-Access-Token` instead of the real access
token (reintroducing the pre-`fe4b1f9` bug), rerun the test, confirm it goes
RED (the captured header is now the ID token — assert the *value*, not just
presence, if the first run didn't already fail: compare `capturedHeader`
against the known mock access token string). Revert the edit before
continuing.

- [ ] **Step 4: Commit**

```bash
git add e2e/tests/profile-forms.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add Change Password X-Access-Token regression coverage (Phase 8 item 2, part 2)

Plan: docs/superpowers/plans/2026-09-20-phase-8-admin-profile-e2e.md
EOF
)"
```

---

### Task 4: `admin-users.ts` seed fixture + `members-admin.spec.ts` (item 3)

**Files:**
- Create: `e2e/fixtures/admin-users.ts`
- Create: `e2e/tests/members-admin.spec.ts`

**Interfaces:**
- Consumes: `routeFailure` from Task 1's `helpers.ts`.
- Produces: `seedDeletedUser(runId: string): Promise<{userId: string; displayName: string}>` and `deleteSeededUser(userId: string): Promise<void>` — write directly to DynamoDB, bypassing the broken `POST /auth/register` path (see plan comment below). Exact table/shape mirrors `aspire/scripts/seed-data.js:43-89`.

**Why seed via DynamoDB instead of the real registration API:** `POST
/auth/register` hard-depends on Cognito's `AdminCreateUserCommand` with no
try/catch — same LocalStack-has-no-Cognito gap as Task 3, so it 500s
locally. `DELETE /admin/users/:id` (real soft-delete) *does* work reliably
(DynamoDB update is unconditional; its own Cognito hard-delete is
best-effort/swallowed) — but using it to reach the `deleted` state would
first require a working *create*, which we don't have. Writing the seed
profile directly, matching the exact shape `aspire/scripts/seed-data.js`
already uses, is the simplest sound path.

- [ ] **Step 1: Read `aspire/scripts/seed-data.js:43-89`** to confirm the
  exact DynamoDB client config (endpoint, region, credentials) and the
  `bluefinwiki-user-profiles-local` item shape (`userId`, `email`,
  `displayName`, `role`, `status`, timestamps) before writing the fixture —
  this plan's snippet below is written from the investigation summary, not a
  direct read; **the implementer must verify field names/types against that
  script's actual `PutCommand` call before trusting this code.**

- [ ] **Step 2: Write `e2e/fixtures/admin-users.ts`**

```ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    endpoint: 'http://localhost:4566',
    region: 'us-east-1',
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  }),
);

const TABLE = 'bluefinwiki-user-profiles-local';

export async function seedDeletedUser(runId: string): Promise<{ userId: string; displayName: string }> {
  const userId = `e2e-${runId}`;
  const displayName = `E2E Deleted User ${runId}`;
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        userId,
        email: `${userId}@example.invalid`,
        displayName,
        role: 'Standard',
        status: 'deleted',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }),
  );
  return { userId, displayName };
}

export async function deleteSeededUser(userId: string): Promise<void> {
  await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { userId } }));
}
```

- [ ] **Step 3: `cd e2e && npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb`**

Check `backend/package.json` first for the exact pinned AWS SDK v3 version
already used elsewhere in this repo and match it, rather than taking
whatever `npm install` resolves to latest — keeping SDK versions aligned
across `backend/` and `e2e/` avoids divergent-behavior surprises.

- [ ] **Step 4: Write `e2e/tests/members-admin.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import { seedDeletedUser, deleteSeededUser } from '../fixtures/admin-users';
import { routeFailure } from './helpers';

test.describe('Members admin', () => {
  test('Edit is disabled for a deleted user', async ({ page }) => {
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const { userId, displayName } = await seedDeletedUser(runId);
    try {
      await page.goto('/admin/users');
      const editBtn = page.getByRole('button', { name: `Edit ${displayName}` });
      await expect(editBtn).toBeVisible();
      await expect(editBtn).toBeDisabled();
    } finally {
      await deleteSeededUser(userId);
    }
  });

  test('a failed member-list load shows Retry, which recovers', async ({ page }) => {
    await routeFailure(page, '**/api/admin/users', 500);
    await page.goto('/admin/users');

    await expect(page.getByText('Failed to load members.')).toBeVisible();
    const retry = page.getByRole('button', { name: 'Retry' });
    await expect(retry).toBeVisible();

    await page.unroute('**/api/admin/users');
    await retry.click();

    await expect(page.getByText('Failed to load members.')).toBeHidden();
  });
});
```

- [ ] **Step 5: Run it**

Run: `dotnet run --project aspire/BlueFinWiki.AppHost` (if not already
running), then `cd e2e && npx playwright test members-admin.spec.ts`
Expected: 2/2 pass. If the DynamoDB seed fails, verify the table name/region
against `aspire/scripts/seed-data.js` per Step 1 before assuming a product
bug.

- [ ] **Step 6: Commit**

```bash
git add e2e/fixtures/admin-users.ts e2e/tests/members-admin.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add Members admin Edit-disabled + Retry coverage (Phase 8 item 3)

Plan: docs/superpowers/plans/2026-09-20-phase-8-admin-profile-e2e.md
EOF
)"
```

---

### Task 5: `invitations-admin.spec.ts` (item 4)

**Files:**
- Create: `e2e/tests/invitations-admin.spec.ts`

**Interfaces:**
- Consumes: nothing new.

- [ ] **Step 1: Write the spec**

`InvitationManagement` (`frontend/src/app/features/admin/invitation-management.ts`):
status filter pills (`mat-button-toggle-group[aria-label="Filter by status"]`,
values All/Pending/Used/Expired/Revoked). `InvitationCreateDialog`: fields
Email (optional)/Role/`Expires (days)` (`type=number min=1 max=30`, default
`7`), Create button disabled outside 1–30 via `canSubmit()`, inline error
text `'Enter a number of days between 1 and 30.'`. On success, a
`role="status"` banner shows `Invitation created: <code>`.

```ts
import { test, expect } from '@playwright/test';

test.describe('Invitations admin', () => {
  test('status filter pills switch the list', async ({ page }) => {
    await page.goto('/admin/invitations');
    for (const label of ['All', 'Pending', 'Used', 'Expired', 'Revoked']) {
      await page.getByRole('button', { name: label }).click();
      // Each click re-triggers GET /api/admin/invitations?status=... — wait
      // for the list region to settle rather than asserting on timing.
      await expect(page.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true').catch(() => {
        // Some Material versions render toggle state via a different attr/role
        // (radio vs pressed button) — verify against the live DOM before
        // finalizing this assertion; see plan note below.
      });
    }
  });

  test('creating an invitation shows its code; expiryDays is validated 1-30, default 7', async ({ page }) => {
    await page.goto('/admin/invitations');
    await page.getByRole('button', { name: 'Create invitation' }).click();

    const dialog = page.getByRole('dialog', { name: 'New Invitation' });
    await expect(dialog.getByLabel('Expires (days)')).toHaveValue('7');

    const create = dialog.getByRole('button', { name: 'Create', exact: true });

    await dialog.getByLabel('Expires (days)').fill('0');
    await expect(dialog.getByText('Enter a number of days between 1 and 30.')).toBeVisible();
    await expect(create).toBeDisabled();

    await dialog.getByLabel('Expires (days)').fill('31');
    await expect(dialog.getByText('Enter a number of days between 1 and 30.')).toBeVisible();
    await expect(create).toBeDisabled();

    await dialog.getByLabel('Expires (days)').fill('30');
    await expect(create).toBeEnabled();

    await create.click();
    await expect(page.getByRole('status').filter({ hasText: 'Invitation created:' })).toBeVisible();
  });
});
```

- [ ] **Step 2: Verify the toggle-pill ARIA pattern before trusting Step-1's assertion**

Angular Material's `mat-button-toggle-group` renders differently depending
on `multiple`/single-select config — run:

Run: `cd e2e && npx playwright test invitations-admin.spec.ts --headed -g "status filter"`

and inspect the actual accessibility tree (Playwright's trace viewer, or a
quick `await page.locator('button', {hasText:'Pending'}).evaluate(el => el.outerHTML)`)
to confirm whether it's `aria-pressed`, `role="radio"`+`aria-checked`, or a
plain `.mat-button-toggle-checked` class, then replace the placeholder
try/catch above with the real, single, correct assertion. **Do not ship the
try/catch fallback — it exists only to unblock writing this plan without a
live browser; resolve it in this step.**

- [ ] **Step 3: Run the full file**

Run: `cd e2e && npx playwright test invitations-admin.spec.ts`
Expected: 2/2 pass.

- [ ] **Step 4: Commit**

```bash
git add e2e/tests/invitations-admin.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add Invitations admin pills+code+validation coverage (Phase 8 item 4)

Plan: docs/superpowers/plans/2026-09-20-phase-8-admin-profile-e2e.md
EOF
)"
```

---

### Task 6: `rebuild-index-confirm.spec.ts` (item 5) + doc close-out

**Files:**
- Create: `e2e/tests/rebuild-index-confirm.spec.ts`
- Modify: `docs/flows/angular-parity-plan/phase-8-admin-profile/README.md`
- Modify: `docs/flows/angular-parity-plan/README.md`

**Interfaces:**
- Consumes: nothing new.

`RebuildPageIndex` (`frontend/src/app/features/admin/rebuild-page-index.ts`):
3-state machine (`running`/`confirming`/`result`). "Rebuild now" →
confirming (no network call yet) → Cancel (back to initial, still no call)
or "Yes, rebuild" → `POST /api/admin/rebuild-page-index` → running → result
section `role="region" name="Rebuild result"`. This endpoint only touches S3
+ DynamoDB (both enabled in LocalStack) so a real success path is achievable
here, unlike Task 3's Change Password.

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from '@playwright/test';

test.describe('Rebuild page index', () => {
  test('requires confirmation before running; cancel makes no request', async ({ page }) => {
    let requestFired = false;
    await page.route('**/api/admin/rebuild-page-index', (route) => {
      requestFired = true;
      route.continue();
    });

    await page.goto('/admin/rebuild-page-index');
    await page.getByRole('button', { name: 'Rebuild now' }).click();

    await expect(page.getByText(/This will scan the entire pages bucket/)).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    expect(requestFired, 'Cancel must not call the rebuild endpoint').toBe(false);

    await expect(page.getByRole('button', { name: 'Rebuild now' })).toBeVisible();
  });

  test('confirming runs the rebuild and shows a result summary', async ({ page }) => {
    test.setTimeout(120_000); // scans the whole shared pages bucket — generous per plan note

    await page.goto('/admin/rebuild-page-index');
    await page.getByRole('button', { name: 'Rebuild now' }).click();
    await page.getByRole('button', { name: 'Yes, rebuild' }).click();

    await expect(page.getByText(/Rebuild in progress/)).toBeVisible();

    const result = page.getByRole('region', { name: 'Rebuild result' });
    await expect(result).toBeVisible({ timeout: 110_000 });
    await expect(page.getByText('Rebuild complete.')).toBeVisible();

    // Don't assert exact counts — other specs' fixture data shares this
    // backend and this test may run interleaved with them. Just confirm the
    // summary fields are present and numeric/non-negative.
    for (const label of ['Pages discovered', 'Rows written', 'Orphan rows deleted', 'Failed', 'Duration (s)']) {
      const dd = result.locator('dt', { hasText: label }).locator('xpath=following-sibling::dd[1]');
      await expect(dd).not.toHaveText('');
    }
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd e2e && npx playwright test rebuild-index-confirm.spec.ts`
Expected: 2/2 pass. If the second test times out, confirm the local
backend/S3-via-LocalStack stack is actually healthy (`docker ps`, Aspire
dashboard) before assuming a product bug — this test's own timeout is
already generous for a slow scan.

- [ ] **Step 3: Update `phase-8-admin-profile/README.md`'s exit criteria**

Tick all 5 boxes `[x]`, each with a one-line note naming its new spec file
(mirror the exact style Phase 1b's own README used — see
`docs/flows/angular-parity-plan/phase-1b-responsive/README.md` post-1b for
the pattern), and note the Change Password caveat explicitly: "automated as
a request-shape/regression check, not a real Cognito success path — local
LocalStack has no Cognito service."

- [ ] **Step 4: Update the top-level status board**

In `docs/flows/angular-parity-plan/README.md`, edit Phase 8's row: replace
"Manual browser walkthrough still owed" with a note pointing at the 6 new
spec files, same style as commit `83b70b0` did for Phase 1b. If this is the
first of the five phase plans to land, also touch the **Total** row's
closing sentence to drop "8" from the "remain owed" list; if a later phase
plan lands after this one, that plan's own final task updates the Total row
instead (see the roadmap doc's "What done means" section) — check
`git log --oneline -- docs/flows/angular-parity-plan/README.md` before
editing to see whether another phase already updated it this session.

- [ ] **Step 5: Full-suite regression check**

Run: `cd e2e && npx playwright test`
Expected: all prior specs + all 6 new files pass (previous 34 + this plan's
~13 new tests). Also run `cd e2e && npx tsc --noEmit` and
`cd frontend && npm test && npm run lint` — no frontend production files
changed by this plan, so both should be unaffected, but confirm.

- [ ] **Step 6: Commit**

```bash
git add e2e/tests/rebuild-index-confirm.spec.ts \
  docs/flows/angular-parity-plan/phase-8-admin-profile/README.md \
  docs/flows/angular-parity-plan/README.md
git commit -m "$(cat <<'EOF'
test(e2e): add rebuild-index confirm-gate coverage, close Phase 8's manual-walkthrough debt (item 5)

Plan: docs/superpowers/plans/2026-09-20-phase-8-admin-profile-e2e.md
EOF
)"
```

---

## Self-Review Notes (for whoever executes this plan)

- **Task 5, Step 2 is a deliberate open question**, not an oversight — the
  investigation agent flagged it couldn't confirm Material's exact
  toggle-group ARIA pattern without a live render. Resolve it before
  trusting the rest of that task's assertions.
- **Task 4's DynamoDB field shape is investigation-derived, not read
  directly from `seed-data.js`** — Step 1 of that task exists specifically
  to close that gap before writing code against it.
- Every "Run it" step assumes the Aspire stack (`dotnet run --project
  aspire/BlueFinWiki.AppHost`) is already up — per this repo's own prior
  session notes, that stack has previously gotten stuck on Docker Desktop
  engine startup; if a task's tests can't reach `localhost:5173`/`:3000` at
  all (not just fail assertions), check `docker info` and the Aspire
  dashboard before debugging the test itself.
